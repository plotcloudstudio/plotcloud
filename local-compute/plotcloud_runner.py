#!/usr/bin/env python3
"""PlotCloud local reference-engine runner. Python 3.10+, stdlib only.
No shell commands from uploaded files. Serve only on the local loopback interface.
"""
import argparse
import csv
import hashlib
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
import webbrowser
import zipfile

RELEASE = 'local-compute-20261028-1'
MAX_BODY = 48 * 1024 * 1024
MAX_TRIANGLES = 180000
MAX_SENSORS = 4096
TERMINAL = ('completed', 'failed', 'cancelled')


def encode(value):
    return json.dumps(value, allow_nan=False, separators=(',', ':'), ensure_ascii=False).encode()


def digest(value):
    return hashlib.sha256(encode(value)).hexdigest()


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate(job):
    require(isinstance(job, dict) and job.get('schema') == 'plotcloud-local-job-v1', 'Unsupported job schema.')
    require(isinstance(job.get('id'), str) and 8 <= len(job['id']) <= 100 and all(c.isalnum() or c in '-_' for c in job['id']), 'Invalid job ID.')
    require(job.get('kind') in ('radiance-df', 'energyplus'), 'Unsupported recipe. Annual daylight and glare are not yet supported.')
    require(job.get('reviewed') is True, 'Review and confirm the analytical inputs before exporting the job.')
    source = job.get('source')
    require(isinstance(source, dict) and all(isinstance(source.get(k), str) and 0 < len(source[k]) < 200 for k in ('projectId', 'versionId', 'modelHash')), 'Missing original project/version/model fingerprint.')
    if job['kind'] == 'radiance-df':
        meshes, sensors = job.get('meshes'), job.get('sensors')
        require(isinstance(meshes, list) and 0 < len(meshes) <= 20000, 'Provide original source meshes.')
        require(isinstance(sensors, list) and 0 < len(sensors) <= MAX_SENSORS, 'Provide 1–4096 reviewed sensors.')
        keys, triangles = set(), 0
        for m in meshes:
            require(isinstance(m, dict) and isinstance(m.get('key'), str) and m['key'] not in keys, 'Mesh IDs must be unique.')
            keys.add(m['key'])
            p, optical = m.get('positions'), m.get('optical', {})
            require(isinstance(p, list) and len(p) >= 9 and len(p) % 9 == 0 and all(finite(n) and abs(n) <= 1e6 for n in p), 'Triangles must be finite world-metre coordinates, in groups of nine.')
            triangles += len(p) // 9
            require(optical.get('type') in ('opaque', 'glass'), 'Assign an optical material to every surface.')
            key = 'reflectance' if optical['type'] == 'opaque' else 'visibleTransmittance'
            require(finite(optical.get(key)) and 0 <= optical[key] <= .95, 'Optical values must be between 0 and 0.95.')
            for i in range(0, len(p), 9):
                a, b = [p[i+3+k]-p[i+k] for k in range(3)], [p[i+6+k]-p[i+k] for k in range(3)]
                cross = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
                require(sum(v*v for v in cross) > 1e-24, 'Degenerate source triangle. Repair the source mesh before calculation.')
        require(triangles <= MAX_TRIANGLES, 'Job exceeds the 180,000-triangle local limit. No geometry was simplified.')
        ids = set()
        for s in sensors:
            require(isinstance(s, dict) and isinstance(s.get('id'), str) and s['id'] not in ids, 'Sensor IDs must be unique.')
            ids.add(s['id'])
            for k in ('position', 'normal'):
                require(isinstance(s.get(k), list) and len(s[k]) == 3 and all(finite(v) and abs(v) <= 1e6 for v in s[k]), 'Sensor position/normal must have three finite coordinates.')
            require(sum(v*v for v in s['normal']) > 1e-12, 'A sensor normal cannot be zero.')
    else:
        model, epw = job.get('epjson'), job.get('epw')
        require(isinstance(model, dict) and model.get('Version') and model.get('Zone'), 'Upload a reviewed EnergyPlus epJSON model with Version and Zone objects. A visual mesh is not a thermal model.')
        require(isinstance(epw, str) and len(epw) < 12*1024*1024 and epw.startswith('LOCATION,'), 'Provide the matching EPW contents.')
        rows = list(csv.reader(io.StringIO(epw)))
        require(len(rows) in (8768, 8792) and all(len(r) >= 35 for r in rows[8:]), 'EPW must have 8 header lines and 8760 or 8784 complete hourly rows.')
        for key in model:
            require(not key.lower().startswith(('pythonplugin', 'externalinterface', 'parametric', 'utilitycost')), 'This runner does not allow plugins, external interfaces, parametric expansion or financial analysis.')
        def no_external(value):
            if isinstance(value, dict):
                for k, v in value.items():
                    require(not (any(x in k.lower() for x in ('file_name', 'filename', 'file_path', 'directory', 'search_path')) and v), 'External file dependencies are not supported. Embed schedules and remove external paths.')
                    no_external(v)
            elif isinstance(value, list):
                for v in value:
                    no_external(v)
        no_external(model)
    return job


def find_engines(radiance_bin=None, energyplus=None):
    rad = Path(radiance_bin).expanduser().resolve() if radiance_bin else None
    lib = None
    if not rad:
        spec = importlib.util.find_spec('pyradiance')
        if spec and spec.origin:
            folder = Path(spec.origin).parent
            rad, lib = folder/'bin', folder/'lib'
    if rad and not lib and (rad.parent/'lib').is_dir():
        lib = rad.parent/'lib'
    def binary(name):
        candidate = rad/(name+('.exe' if os.name == 'nt' else '')) if rad else None
        return str(candidate) if candidate and candidate.is_file() else shutil.which(name)
    binaries = {k: binary(k) for k in ('gensky', 'oconv', 'rtrace')}
    ep = str(Path(energyplus).expanduser().resolve()) if energyplus else shutil.which('energyplus')
    if ep and not Path(ep).is_file():
        ep = None
    return {**binaries, 'energyplus': ep, 'raypath': str(lib) if lib else None}


class Job:
    def __init__(self, body, root):
        self.body, self.hash = body, digest(body)
        self.folder = Path(tempfile.mkdtemp(prefix='pc-job-', dir=root))
        self.state, self.stage, self.error = 'queued', 'Waiting for local worker', None
        self.created, self.started, self.finished = time.time(), None, None
        self.cancel = threading.Event()
        self.process = None
        self.result = None
        (self.folder/'input.pcjob.json').write_bytes(encode(body))

    def public(self):
        return {'id': self.body['id'], 'kind': self.body['kind'], 'state': self.state, 'stage': self.stage,
                'elapsedSeconds': round((self.finished or time.time())-(self.started or self.created), 1),
                'error': self.error, 'inputSha256': self.hash}

    def stop(self):
        self.cancel.set()
        # All accepted engine invocations are foreground programs, without shell descendants.
        if self.process and self.process.poll() is None:
            try:
                self.process.kill()
            except ProcessLookupError:
                pass


def command(job, args, stem, stdin=None, timeout=3600, env=None):
    if job.cancel.is_set():
        raise InterruptedError('Cancelled by user.')
    out, err = job.folder/(stem+'.out'), job.folder/(stem+'.err')
    with out.open('wb') as stdout, err.open('wb') as stderr:
        process = subprocess.Popen(args, cwd=job.folder, stdin=subprocess.PIPE if stdin is not None else subprocess.DEVNULL,
                                   stdout=stdout, stderr=stderr, env=env, shell=False)
        job.process = process
        if job.cancel.is_set():
            process.kill()
        deadline, first = time.monotonic()+timeout, True
        try:
            while True:
                try:
                    process.communicate(input=stdin if first else None, timeout=.5)
                    break
                except subprocess.TimeoutExpired:
                    first = False
                    if time.monotonic() >= deadline:
                        raise RuntimeError('Engine time limit reached. No completed result was published.')
                    size = sum(p.stat().st_size for p in job.folder.rglob('*') if p.is_file())
                    if size > 256*1024*1024:
                        raise RuntimeError('Local job exceeded its 256 MiB file limit. Reduce the requested output and export a new task.')
        except Exception:
            process.kill()
            process.wait()
            raise
        finally:
            job.process = None
    if job.cancel.is_set():
        raise InterruptedError('Cancelled by user.')
    if process.returncode:
        raise RuntimeError(f'{Path(args[0]).name} failed (exit {process.returncode}). '+err.read_text(errors='replace')[-2500:])
    return out


def radiance_scene(body):
    lines = []
    for i, mesh in enumerate(body['meshes']):
        optical = mesh['optical']
        if optical['type'] == 'glass':
            vt = optical['visibleTransmittance']
            t = 0 if vt == 0 else (math.sqrt(.8402528435+.0072522239*vt*vt)-.9166530661)/(.0036261119*vt)
            lines.append(f'void glass m{i}\n0\n0\n3 {t:.12g} {t:.12g} {t:.12g}\n')
        else:
            r = optical['reflectance']
            lines.append(f'void plastic m{i}\n0\n0\n5 {r} {r} {r} 0 0\n')
        p = mesh['positions']
        for t in range(len(p)//9):
            coords = ' '.join(format(v, '.15g') for v in p[t*9:t*9+9])
            lines.append(f'm{i} polygon p{i}_{t}\n0\n0\n9 {coords}\n')
    return '\n'.join(lines)


def run_radiance(job, engines):
    require(all(engines.get(k) for k in ('gensky', 'oconv', 'rtrace')), 'Radiance is not installed. Install pyradiance==1.3.1 or provide --radiance-bin.')
    env = os.environ.copy()
    env['RAYPATH'] = '.'+os.pathsep+(engines.get('raypath') or env.get('RAYPATH', '.'))
    job.stage = 'Generating CIE overcast reference sky'
    version = command(job, [engines['rtrace'], '-version'], 'radiance-version', timeout=30, env=env)
    version_text = (version.read_text(errors='replace')+(job.folder/'radiance-version.err').read_text(errors='replace')).strip()
    sky = command(job, [engines['gensky'], '3', '21', '12', '-c', '-B', '100'], 'sky', env=env)
    sky_text = sky.read_text()+'\nskyfunc glow sky_glow\n0\n0\n4 1 1 1 0\nsky_glow source sky\n0\n0\n4 0 0 1 180\n'
    (job.folder/'sky.rad').write_text(sky_text)
    (job.folder/'model.rad').write_text(radiance_scene(job.body))
    job.stage = 'Compiling original geometry and reviewed optical materials'
    sky_oct = command(job, [engines['oconv'], 'sky.rad'], 'sky-oct', env=env)
    model_oct = command(job, [engines['oconv'], 'sky.rad', 'model.rad'], 'model-oct', env=env)
    params = ['-I+', '-h', '-w', '-ab', '5', '-ad', '4096', '-as', '1024', '-aa', '.1', '-ar', '128', '-lw', '.0001', '-n', '1']
    ref = command(job, [engines['rtrace'], *params, str(sky_oct)], 'reference', stdin=b'0 0 0 0 0 1\n', env=env)
    def illuminance(line):
        v = [float(x) for x in line.split()]
        require(len(v) == 3 and all(math.isfinite(x) and x >= 0 for x in v), 'Invalid Radiance RGB irradiance output.')
        return 179*(.265*v[0]+.670*v[1]+.065*v[2])
    exterior = illuminance(ref.read_text().strip())
    require(exterior > 0, 'Exterior reference illuminance is zero or invalid.')
    sensor_input = []
    for s in job.body['sensors']:
        n = math.sqrt(sum(x*x for x in s['normal']))
        sensor_input.append(' '.join(format(v, '.15g') for v in s['position']+[x/n for x in s['normal']]))
    job.stage = f'Tracing {len(sensor_input)} sensors · engine progress is indeterminate'
    output = command(job, [engines['rtrace'], *params, str(model_oct)], 'sensors', stdin=('\n'.join(sensor_input)+'\n').encode(), env=env)
    lines = [line for line in output.read_text().splitlines() if line.strip()]
    require(len(lines) == len(sensor_input), 'Radiance sensor count mismatch. Incomplete results were rejected.')
    values = []
    for sensor, line in zip(job.body['sensors'], lines):
        lux = illuminance(line)
        values.append({**sensor, 'illuminanceLux': lux, 'daylightFactorPercent': lux/exterior*100})
    return {'metric': 'daylight_factor', 'unit': '%', 'sensors': values,
            'mean': sum(s['daylightFactorPercent'] for s in values)/len(values), 'exteriorReferenceLux': exterior,
            'solver': {'name': 'Radiance', 'version': version_text, 'parameters': params},
            'method': 'CIE overcast daylight factor; neutral RGB optical materials; no sun or EPW. 179 lm/W photopic RGB conversion. Unweighted sensor mean, not annual sDA/ASE or certification.',
            'limitations': ['Glazing must represent a single optical boundary; solid glazing meshes can attenuate light repeatedly.', 'No automatic room/occupied-area classification, blinds or BSDF materials. Unmodeled ground contributes no reflected light.', 'Use converged geometry, material and sensor assumptions; numerical engine accuracy does not validate preparation.']}


def run_energyplus(job, engines):
    require(engines.get('energyplus'), 'EnergyPlus is not installed. Install a matching official release and provide --energyplus /path/to/energyplus.')
    (job.folder/'model.epJSON').write_bytes(encode(job.body['epjson']))
    (job.folder/'weather.epw').write_text(job.body['epw'])
    job.stage = 'Checking installed EnergyPlus version'
    version = command(job, [engines['energyplus'], '--version'], 'energyplus-version', timeout=30).read_text().strip()
    versions = list(job.body['epjson']['Version'].values())
    requested = versions[0].get('version_identifier', '') if versions else ''
    import re
    expected, actual = re.search(r'\d+\.\d+', requested), re.search(r'\d+\.\d+', version)
    require(expected and actual and expected.group() == actual.group(), 'EnergyPlus version mismatch. Export matching epJSON or install the matching engine; no automatic transition is performed.')
    job.stage = 'EnergyPlus running · see engine logs for timestep details'
    command(job, [engines['energyplus'], '-w', 'weather.epw', '-d', 'outputs', 'model.epJSON'], 'energyplus', timeout=4*3600)
    outputs = job.folder/'outputs'
    end = outputs/'eplusout.end'
    require(end.is_file() and 'EnergyPlus Completed Successfully' in end.read_text(errors='replace'), 'EnergyPlus did not finish successfully. Inspect the .err output; no normal result was published.')
    error_log = (outputs/'eplusout.err').read_text(errors='replace') if (outputs/'eplusout.err').is_file() else ''
    require(not re.search(r'\*\*\s*(?:Severe|Fatal)\s*\*\*', error_log), 'EnergyPlus reported severe/fatal model errors. Inspect the engine output.')
    files = [p.name for p in outputs.iterdir() if p.is_file()]
    return {'metric': 'engine_output', 'unit': None, 'solver': {'name': 'EnergyPlus', 'version': version},
            'method': 'Reviewed user-supplied epJSON and matching EPW; original engine outputs retained. No inferred thermal zones or invented EUI.',
            'completion': end.read_text(errors='replace'), 'warnings': error_log[-20000:], 'files': files,
            'limitations': ['Loads, delivered energy and comfort depend on the actual submitted model and requested outputs.', 'The runner does not infer constructions, occupancy, HVAC, design days or valid thermal adjacency from visual triangles.']}


class Runner:
    def __init__(self, root, engines):
        self.root, self.engines = Path(root).resolve(), engines
        self.root.mkdir(parents=True, exist_ok=True)
        self.jobs, self.lock = {}, threading.Lock()
        self.token = secrets.token_urlsafe(32)

    def submit(self, body):
        validate(body)
        with self.lock:
            old = self.jobs.get(body['id'])
            if old:
                require(old.hash == digest(body), 'Job ID already used for different inputs. Export a new job.')
                return old
            require(len(self.jobs) < 64, 'Session job limit reached. Back up results and restart the runner.')
            require(not any(j.state not in TERMINAL for j in self.jobs.values()), 'A local job is already running. Wait or cancel before submitting another.')
            job = Job(body, self.root)
            self.jobs[body['id']] = job
            threading.Thread(target=self.execute, args=(job,), daemon=True).start()
            return job

    def execute(self, job):
        job.started, job.state = time.time(), 'running'
        try:
            data = run_radiance(job, self.engines) if job.body['kind'] == 'radiance-df' else run_energyplus(job, self.engines)
            if job.cancel.is_set():
                raise InterruptedError('Cancelled by user.')
            job.result = {'schema': 'plotcloud-local-result-v1', 'release': RELEASE, 'id': job.body['id'], 'kind': job.body['kind'],
                          'state': 'completed', 'source': job.body['source'], 'inputSha256': job.hash, 'completedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'result': data}
            (job.folder/'result.pcresult.json').write_bytes(encode(job.result))
            job.state, job.stage = 'completed', 'Completed · export results and source archive'
        except InterruptedError as error:
            job.state, job.stage, job.error = 'cancelled', 'Cancelled · no result published', str(error)
        except Exception as error:
            job.state, job.stage, job.error = 'failed', 'Failed · no result published', str(error)
        finally:
            job.finished = time.time()


def serve(runner, port):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(30)

        def log_message(self, *args):
            pass  # Never log authorization headers or browser session tokens.

        def send(self, status, value, kind='application/json'):
            body = value if isinstance(value, bytes) else encode(value)
            self.send_response(status)
            self.send_header('Content-Type', kind)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(body)

        def dispatch(self):
            try:
                authority = f'127.0.0.1:{self.server.server_port}'
                require(self.headers.get('Host') == authority, 'Only the local loopback host is accepted.')
                origin = self.headers.get('Origin')
                require(origin is None or origin == 'http://'+authority, 'Open the local runner page. Cross-origin access is disabled; use the file handoff.')
                path = urlsplit(self.path).path
                if self.command == 'GET' and path == '/':
                    return self.send(200, DASHBOARD.encode(), 'text/html; charset=utf-8')
                require(secrets.compare_digest(self.headers.get('Authorization', ''), 'Bearer '+runner.token), 'Invalid local session token. Reopen the runner URL shown in your terminal.')
                if path == '/api/health' and self.command == 'GET':
                    return self.send(200, {'release': RELEASE, 'engines': {k: bool(runner.engines.get(k)) for k in ('rtrace', 'oconv', 'gensky', 'energyplus')}, 'jobs': [j.public() for j in runner.jobs.values()]})
                if path == '/api/jobs' and self.command == 'POST':
                    size = int(self.headers.get('Content-Length', '0'))
                    require(0 < size <= MAX_BODY and self.headers.get_content_type() == 'application/json', 'Upload a JSON job smaller than 48 MiB.')
                    body = json.loads(self.rfile.read(size), parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Nonfinite JSON number.')))
                    return self.send(202, runner.submit(body).public())
                parts = path.split('/')
                require(len(parts) in (4, 5) and parts[:3] == ['', 'api', 'jobs'] and parts[3] in runner.jobs, 'Job not found in this session.')
                job = runner.jobs[parts[3]]
                action = parts[4] if len(parts) == 5 else ''
                if action == 'cancel' and self.command == 'POST':
                    if job.state not in TERMINAL:
                        job.stop()
                    return self.send(200, job.public())
                require(self.command == 'GET', 'Unsupported method.')
                if not action:
                    return self.send(200, job.public())
                if action == 'result':
                    require(job.state == 'completed', 'Job has no completed result.')
                    return self.send(200, job.result)
                if action == 'archive':
                    require(job.state in TERMINAL, 'Stop or finish the job before exporting files.')
                    archive = io.BytesIO()
                    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
                        for p in job.folder.rglob('*'):
                            if p.is_file() and not p.is_symlink():
                                z.write(p, str(p.relative_to(job.folder)))
                    return self.send(200, archive.getvalue(), 'application/zip')
                raise ValueError('Unknown endpoint.')
            except (ValueError, KeyError, TypeError) as error:
                self.send(400, {'error': str(error)})
            except Exception:
                self.send(500, {'error': 'Local request failed. Check the terminal and job logs.'})

        do_GET = dispatch
        do_POST = dispatch
        do_OPTIONS = dispatch
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.timeout = 1
    server.daemon_threads = True
    return server


DASHBOARD = r'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PlotCloud local compute</title><style>
:root{color-scheme:dark}body{font:15px/1.6 system-ui;background:#484b4e;color:#f0f1f1;max-width:1000px;margin:32px auto;padding:0 20px}h1{font-size:26px}section{padding:20px;background:#55595c;margin:18px 0;border:1px solid #777;border-radius:10px}button,input{font:inherit;color:inherit;background:#62686b;border:1px solid #999;border-radius:5px;padding:9px;max-width:100%;box-sizing:border-box}button{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#bbdeed}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px;border-bottom:1px solid #888}progress{width:100%}[hidden]{display:none!important}</style>
<h1>PlotCloud local compute</h1><p>Reference engines run on this computer. Model files stay here. Keep this terminal and page open.</p><section><h2>1. Check engines</h2><pre id="health">Checking…</pre><p>Radiance: install <code>python -m pip install pyradiance==1.3.1</code>. EnergyPlus: install the official version matching your epJSON and start with <code>--energyplus /path/to/energyplus</code>. Python itself does not include these engines.</p></section><section><h2>2. Load a reviewed job</h2><input type="file" id="file" accept=".json"><button id="run" disabled>Run job</button><p id="source">Export a .pcjob.json from PlotCloud’s Local compute page.</p><p>One job at a time. Maximum input 48 MiB, 180,000 triangles and 4,096 sensors. No geometry simplification or automatic engine substitution.</p></section><section><h2>3. Calculation & export</h2><label>Existing session job <select id="existing"></select></label> <button id="resume">Show job / resume status</button><p id="status" role="status" aria-live="polite">No job started.</p><progress id="progress" hidden></progress><button id="cancel" hidden>Cancel job</button><button id="result" disabled>Download result JSON</button><button id="archive" disabled>Download input + engine files (ZIP)</button><pre id="summary"></pre><p>Import a completed .pcresult.json on PlotCloud. Failed jobs have logs and inputs in their ZIP archive, but no fabricated normal result.</p></section>
<script>
let token=location.hash.slice(1)||sessionStorage.getItem('pc-local-token')||'';sessionStorage.setItem('pc-local-token',token);history.replaceState(null,'',location.pathname);let body=null,job=null,timer=null,busy=false;
const $=id=>document.getElementById(id);async function api(path,method='GET',data){const r=await fetch('/api/'+path,{method,headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});if(!r.ok)throw Error((await r.json()).error||'Request failed');return r;}
async function health(){try{const h=await(await api('health')).json();$('existing').replaceChildren(...h.jobs.map(j=>{const o=document.createElement('option');o.value=j.id;o.textContent=j.kind+' · '+j.state+' · '+j.id;return o;}));$('health').textContent=Object.entries(h.engines).map(([k,v])=>k+': '+(v?'detected':'not installed')).join('\n');}catch(e){$('health').textContent=e.message;}}health();
$('file').onchange=async()=>{body=null;$('run').disabled=true;try{const f=$('file').files[0];if(!f)return;if(f.size>48*1024*1024)throw Error('Maximum input is 48 MiB.');body=JSON.parse(await f.text());if(body.schema!=='plotcloud-local-job-v1'||!body.reviewed)throw Error('A reviewed PlotCloud job is required.');$('source').textContent=body.kind+' · '+JSON.stringify(body.source);$('run').disabled=busy;}catch(e){$('source').textContent=e.message;}};
$('run').onclick=async()=>{if(busy||!body)return;busy=true;$('run').disabled=true;$('result').disabled=true;$('archive').disabled=true;$('summary').textContent='';try{job=await(await api('jobs','POST',body)).json();health();$('cancel').hidden=false;$('progress').hidden=false;poll();}catch(e){busy=false;$('run').disabled=false;$('status').textContent=e.message;}};
async function poll(){try{job=await(await api('jobs/'+job.id)).json();$('status').textContent=job.state+' · '+job.stage+' · elapsed '+job.elapsedSeconds+' s'+(job.error?'\n'+job.error:'');if(['completed','failed','cancelled'].includes(job.state)){busy=false;$('progress').hidden=true;$('cancel').hidden=true;$('run').disabled=!body;$('archive').disabled=false;$('result').disabled=job.state!=='completed';if(job.state==='completed'){const r=await(await api('jobs/'+job.id+'/result')).json();$('summary').textContent=JSON.stringify({solver:r.result.solver,meanDaylightFactorPercent:r.result.mean,completion:r.result.completion,limitations:r.result.limitations},null,2);}return;}timer=setTimeout(poll,1000);}catch(e){$('status').textContent='Connection interrupted: '+e.message+'. Keep the runner open and reload this page to inspect the existing job; do not re-export a new job.';busy=false;$('run').disabled=!body;$('progress').hidden=true;}}
$('resume').onclick=()=>{const id=$('existing').value;if(!id)return;clearTimeout(timer);job={id};busy=true;$('run').disabled=true;$('result').disabled=true;$('archive').disabled=true;$('cancel').hidden=false;$('progress').hidden=false;poll();};
$('cancel').onclick=async()=>{try{await api('jobs/'+job.id+'/cancel','POST');}catch(e){$('status').textContent=e.message;}};
async function download(action,ext){try{const blob=await(await api('jobs/'+job.id+'/'+action)).blob(),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=job.id+ext;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}catch(e){$('status').textContent=e.message;}}
$('result').onclick=()=>download('result','.pcresult.json');$('archive').onclick=()=>download('archive','.zip');
</script></html>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8768)
    parser.add_argument('--radiance-bin')
    parser.add_argument('--energyplus')
    parser.add_argument('--jobs-dir', default=str(Path.home()/'PlotCloud-local-jobs'))
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    runner = Runner(args.jobs_dir, find_engines(args.radiance_bin, args.energyplus))
    server = serve(runner, args.port)
    url = f'http://127.0.0.1:{server.server_port}/#{runner.token}'
    print('PlotCloud local compute '+RELEASE+'\nOpen this private local session URL:\n'+url+'\nJob files: '+str(runner.root)+'\nPress Ctrl+C to stop. Do not share the session URL.', flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever(poll_interval=.5)
    except KeyboardInterrupt:
        pass
    finally:
        for job in runner.jobs.values():
            job.stop()
        server.server_close()


if __name__ == '__main__':
    main()
