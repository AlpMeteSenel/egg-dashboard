import {spawnSync} from 'node:child_process';
const address=process.argv[2]||'192.168.1.194';
if(!/^[a-zA-Z0-9.-]+$/.test(address))throw Error('Use the board hostname or IP address.');
const result=spawnSync('ssh',['-M','-S','/tmp/swarmflow-egg-live.sock','-f','-N','-o','ControlPersist=8h','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=5','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=3','-L','127.0.0.1:18765:127.0.0.1:8091','-R','127.0.0.1:18080:127.0.0.1:3000','arduino@'+address],{stdio:'inherit'});
if(result.status!==0){console.error('Wi-Fi connection failed. Check the board address and that both devices are on the same network.');process.exitCode=result.status||1;}else console.log('Egg connected over Wi-Fi. http://localhost:3000 · Node controls http://localhost:18765');
