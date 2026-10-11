import unittest,tempfile,json,base64
from unittest.mock import patch
import publisher
from pathlib import Path
from publisher import packet_from_state,Outbox
class Tests(unittest.TestCase):
 def test_cfg_routes_to_peer_and_mirrors_only_reserved_crossing_without_enabling_lights(self):
  polygon=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]]
  cfg={'local_config':'local','cfg_endpoint':'peer','sync_crossing_zone':True}
  settings={'cfg':{'zones':[{'id':'cars','polygon':polygon},{'id':'crossing','polygon':polygon}]}}
  with patch.object(publisher,'request',side_effect=[{'ok':True},{'ok':True}]) as send:
   self.assertTrue(publisher.apply_settings(cfg,settings));self.assertEqual(send.call_args_list[0].args,('peer',settings));self.assertEqual(send.call_args_list[1].args,('local',{'zone':polygon}))
  with patch.object(publisher,'request',side_effect=[{'ok':True},{'ok':False}]):self.assertFalse(publisher.apply_settings(cfg,settings))
  with patch.object(publisher,'request',return_value={'ok':True}) as send:
   self.assertTrue(publisher.apply_settings({**cfg,'sync_crossing_zone':False},settings));self.assertEqual(send.call_count,1)
  with patch.object(publisher,'request',side_effect=[{'ok':True},{'ok':True}]) as send:
   publisher.apply_settings(cfg,{'cfg':{'zones':[]}});self.assertEqual(send.call_args_list[1].args,('local',{'zone':None}))
 def test_versioned_esp_worker_config_ack_is_not_reported_as_failure(self):
  settings={'cfg':{'zones':[]}}
  with patch.object(publisher,'request',return_value={'cfg':settings['cfg'],'v':2,'hash':'abcdef12'}):self.assertTrue(publisher.apply_settings({'local_config':'local','cfg_endpoint':'peer'},settings))
  with patch.object(publisher,'request',return_value={'cfg':{'different':True},'v':2,'hash':'abcdef12'}):self.assertFalse(publisher.apply_settings({'local_config':'local','cfg_endpoint':'peer'},settings))
 def test_packet_carries_live_geometry_but_never_persists_camera_bytes(self):
  state={'mcu_ok':True,'camera':{'stream_id':'stream','frame_id':4,'capture_ts':1700000000,'source_kind':'live','frame':'JPEG','fps':4},'vision':{'camera_mode':'crosswalk','auto_led':True,'tracks':[],'counts':{'person':3},'bus_stop':{}}}
  packet,jpg=packet_from_state(state,'egg');self.assertEqual(jpg,'JPEG');self.assertNotIn('preview',packet);self.assertEqual(packet['vision']['auto_led'],True)
  with tempfile.TemporaryDirectory() as tmp:
   path=Path(tmp)/'outbox.db';queue=Outbox(path);queue.put(packet);queue.put(packet);self.assertEqual(queue.count(),1);self.assertEqual(queue.pending()[0][1]['vision']['counts'],{'person':3});queue.db.close();queue=Outbox(path);self.assertEqual(queue.count(),1);queue.remove(packet['sample_id']);self.assertEqual(queue.count(),0);queue.db.close()
 def test_full_frame_is_forwarded_when_resize_library_is_missing(self):
  raw=base64.b64encode(b'\xff\xd8\xff\xd9').decode()
  with patch.dict('sys.modules',{'cv2':None,'numpy':None}):
   self.assertEqual(publisher.compact_preview(raw),raw)
   self.assertIsNone(publisher.compact_preview('not-a-jpeg'))
   self.assertIsNone(publisher.compact_preview('x'*850001))
 def test_command_results_survive_restart_until_acknowledged(self):
  with tempfile.TemporaryDirectory() as tmp:
   path=Path(tmp)/'queue.db';q=Outbox(path);q.done('abc',{'id':'abc','ok':True});q.db.close();q=Outbox(path);result=q.results();self.assertEqual(result,[{'id':'abc','ok':True}]);q.acknowledged_results(result);self.assertEqual(q.results(),[]);q.db.close()
 def test_transport_failure_is_queued_without_crashing_and_batch_retry_drains(self):
  class EndLoop(BaseException):pass
  state={'camera':{'capture_ts':1700000000,'frame_id':1,'source_kind':'live'},'vision':{}}
  with tempfile.TemporaryDirectory() as tmp:
   config={'node_id':'egg','local_state':'state','endpoint':'server','token':'test','local_config':'control'}
   with patch.object(publisher,'__file__',str(Path(tmp)/'publisher.py')),patch.object(publisher,'request',side_effect=[state,TimeoutError()]),patch.object(publisher.time,'sleep',side_effect=EndLoop):
    with self.assertRaises(EndLoop):publisher.run(config)
   status=json.loads((Path(tmp)/'publisher-status.json').read_text());self.assertEqual(status['queued_samples'],1);self.assertEqual(status['error'],'TimeoutError; will retry')
   sample_id=publisher.packet_from_state(state,'egg')[0]['sample_id']
   with patch.object(publisher,'__file__',str(Path(tmp)/'publisher.py')),patch.object(publisher,'request',side_effect=[state,{'ok':True,'commands':[]},{'ok':True,'acknowledged':[sample_id]}]) as send,patch.object(publisher.time,'sleep',side_effect=EndLoop):
    with self.assertRaises(EndLoop):publisher.run(config)
    self.assertEqual(len(send.call_args_list[2].args[1]['samples']),1)
   status=json.loads((Path(tmp)/'publisher-status.json').read_text());self.assertEqual(status['queued_samples'],0);self.assertIsNone(status['error'])
if __name__=='__main__':unittest.main()
