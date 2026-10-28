"""Integration checks use real engines when installed, with no production model fixtures."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
import urllib.request
import urllib.error
import sys

spec = importlib.util.spec_from_file_location('pc_runner', Path(__file__).parents[1]/'local-compute/plotcloud_runner.py')
pc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pc)


def mesh(key, p, kind='opaque', value=.5):
    return {'key':key,'positions':p,'optical':{'type':kind,'reflectance' if kind=='opaque' else 'visibleTransmittance':value}}


def quad(key,a,b,c,d,kind='opaque',value=0):
    return mesh(key,a+b+c+a+c+d,kind,value)


def fixture():
    return {'schema':'plotcloud-local-job-v1','id':'local-reference-01','kind':'radiance-df','reviewed':True,
            'source':{'projectId':'analytical-test','versionId':'v1','modelHash':'explicit-test-only'},
            'meshes':[mesh('remote-triangle',[100,100,0,101,100,0,100,101,0])],
            'sensors':[{'id':'s1','position':[0,0,1],'normal':[0,0,1]}]}


def wait(job, seconds=300):
    deadline=time.monotonic()+seconds
    while job.state not in pc.TERMINAL and time.monotonic()<deadline:
        time.sleep(.05)
    if job.state not in pc.TERMINAL:
        job.stop()
        raise AssertionError('Test engine timed out.')
    return job


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.runner=pc.Runner(self.temp.name,pc.find_engines(energyplus=os.environ.get('ENERGYPLUS_EXE')))

    def tearDown(self):
        for j in self.runner.jobs.values():
            j.stop()
        self.temp.cleanup()

    def test_validation_and_original_geometry(self):
        body=fixture();original=copy.deepcopy(body)
        pc.validate(body);scene=pc.radiance_scene(body)
        self.assertIn('100 100 0 101 100 0 100 101 0',scene)
        self.assertEqual(body,original)
        for change in [lambda b:b.update(reviewed=False),lambda b:b['sensors'][0].update(normal=[0,0,0]),lambda b:b['meshes'][0]['optical'].update(reflectance=1.1),lambda b:b['meshes'][0].update(positions=[0]*9),lambda b:b.update(sensors=b['sensors']*4097)]:
            b=copy.deepcopy(body);change(b)
            with self.assertRaises(ValueError):pc.validate(b)
        glass=fixture();glass['meshes'][0]['optical']={'type':'glass','visibleTransmittance':.6}
        self.assertIn('void glass',pc.radiance_scene(glass))
        self.assertNotIn('3 0.6 0.6 0.6',pc.radiance_scene(glass),'visible transmittance must be converted to Radiance transmissivity')

    def test_missing_engine_and_idempotency(self):
        self.runner.engines={}
        b=fixture();j=wait(self.runner.submit(b))
        self.assertEqual(j.state,'failed');self.assertIsNone(j.result);self.assertIn('not installed',j.error)
        self.assertIs(j,self.runner.submit(copy.deepcopy(b)))
        b['sensors'][0]['position'][0]=1
        with self.assertRaisesRegex(ValueError,'different inputs'):self.runner.submit(b)
        self.assertFalse((j.folder/'result.pcresult.json').exists())

    def test_cancellation_kills_foreground_engine(self):
        b=fixture();j=pc.Job(b,self.temp.name);j.state='running'
        errors=[]
        def execute():
            try:pc.command(j,[sys.executable,'-c','import time;time.sleep(90)'],'cancel',timeout=10)
            except Exception as e:errors.append(e)
        thread=threading.Thread(target=execute);thread.start()
        deadline=time.monotonic()+3
        while j.process is None and time.monotonic()<deadline:time.sleep(.01)
        j.stop();thread.join(3)
        self.assertFalse(thread.is_alive());self.assertTrue(errors and isinstance(errors[0],InterruptedError))

    def test_http_token_origin_host_and_real_file_api(self):
        self.runner.engines={};server=pc.serve(self.runner,0);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        base='http://127.0.0.1:'+str(server.server_port)
        def req(path,headers=None,data=None):
            return urllib.request.urlopen(urllib.request.Request(base+path,data=data,headers=headers or {}),timeout=10)
        auth={'Authorization':'Bearer '+self.runner.token}
        try:
            self.assertIn('PlotCloud local compute',req('/').read().decode())
            for path,headers in [('/api/health',{}),('/api/health',{**auth,'Origin':'https://untrusted.invalid'}),('/api/health',{**auth,'Host':'attacker.invalid'})]:
                with self.assertRaises(urllib.error.HTTPError):req(path,headers)
            health=json.load(req('/api/health',auth));self.assertFalse(health['engines']['rtrace'])
            job=json.load(req('/api/jobs',{**auth,'Content-Type':'application/json'},pc.encode(fixture())))
            wait(self.runner.jobs[job['id']])
            status=json.load(req('/api/jobs/'+job['id'],auth));self.assertEqual(status['state'],'failed')
            with self.assertRaises(urllib.error.HTTPError):req('/api/jobs/'+job['id']+'/result',auth)
            self.assertTrue(req('/api/jobs/'+job['id']+'/archive',auth).read().startswith(b'PK'))
        finally:server.shutdown();server.server_close()

    def test_real_radiance_open_closed_and_glazing(self):
        if not all(self.runner.engines.get(k) for k in ('rtrace','oconv','gensky')):
            if os.environ.get('REQUIRE_RADIANCE'):self.fail('Required actual Radiance binaries are missing.')
            self.skipTest('Radiance not installed.')
        b=fixture();original=copy.deepcopy(b);j=wait(self.runner.submit(b));self.assertEqual(j.state,'completed',j.error)
        self.assertAlmostEqual(j.result['result']['mean'],100,delta=.1);self.assertEqual(b,original)
        walls=[quad('floor',[-2,-2,0],[2,-2,0],[2,2,0],[-2,2,0]),quad('north',[-2,2,0],[2,2,0],[2,2,3],[-2,2,3]),quad('south',[-2,-2,0],[2,-2,0],[2,-2,3],[-2,-2,3]),quad('east',[2,-2,0],[2,2,0],[2,2,3],[2,-2,3]),quad('west',[-2,-2,0],[-2,2,0],[-2,2,3],[-2,-2,3])]
        roof=quad('roof',[-2,-2,3],[2,-2,3],[2,2,3],[-2,2,3])
        b=fixture();b['id']='closed-room-01';b['meshes']=walls+[roof];j=wait(self.runner.submit(b));self.assertEqual(j.state,'completed',j.error);self.assertAlmostEqual(j.result['result']['mean'],0,delta=.001)
        values=[]
        for vt in (.4,.8):
            b=fixture();b['id']='glass-room-'+str(int(vt*10));glass=copy.deepcopy(roof);glass['optical']={'type':'glass','visibleTransmittance':vt};b['meshes']=walls+[glass];j=wait(self.runner.submit(b));self.assertEqual(j.state,'completed',j.error);values.append(j.result['result']['mean'])
        self.assertTrue(0<values[0]<values[1]<100,values)
        self.assertGreater(values[1]/values[0],1.7)
        print('ACTUAL Radiance open=100%, closed=0%, glazing .4/.8=',values)

    def test_real_energyplus_official_example(self):
        exe=self.runner.engines.get('energyplus');model=os.environ.get('ENERGYPLUS_MODEL');epw=os.environ.get('ENERGYPLUS_EPW')
        if not exe or not model or not epw:
            if os.environ.get('REQUIRE_ENERGYPLUS'):self.fail('Required EnergyPlus executable/example/weather missing.')
            self.skipTest('Set ENERGYPLUS_EXE, ENERGYPLUS_MODEL and ENERGYPLUS_EPW for official-example validation.')
        b=fixture();b.update(id='energyplus-official-01',kind='energyplus',epjson=json.loads(Path(model).read_text()),epw=Path(epw).read_text());b.pop('meshes');b.pop('sensors');j=wait(self.runner.submit(b),240)
        self.assertEqual(j.state,'completed',j.error)
        self.assertIn('EnergyPlus Completed Successfully',j.result['result']['completion'])
        self.assertTrue(j.result['result']['files'])
        print('ACTUAL',j.result['result']['solver'],j.result['result']['completion'])
        # No auto-transition or fabricated success for a version mismatch or an invalid building.
        b['id']='energyplus-mismatch-01';next(iter(b['epjson']['Version'].values()))['version_identifier']='1.0';j=wait(self.runner.submit(b));self.assertEqual(j.state,'failed');self.assertIn('version mismatch',j.error);self.assertIsNone(j.result)
        b['epjson']['PythonPlugin:Instance']={'bad':{'python_module_name':'not_allowed'}}
        with self.assertRaisesRegex(ValueError,'plugins'):pc.validate(b)


if __name__=='__main__':unittest.main(verbosity=2)
