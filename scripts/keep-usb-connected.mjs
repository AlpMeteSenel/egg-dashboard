import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
const adb=homedir()+'/Library/Arduino15/packages/arduino/tools/adb/32.0.0/adb';
const serial='3409224453';let previous='';
function connect(){let status;try{
 const devices=execFileSync(adb,['devices'],{encoding:'utf8',timeout:6000,stdio:['ignore','pipe','ignore']});
 if(!devices.includes(serial+'\tdevice'))throw Error('Connect Egg by USB');
 for(const [direction,from,to] of [['reverse','18080','3000'],['forward','18765','8091'],['forward','19011','9011']])execFileSync(adb,['-s',serial,direction,'tcp:'+from,'tcp:'+to],{timeout:5000,stdio:'ignore'});
 status='Egg USB telemetry and local controls connected';
}catch{status='Waiting for Egg USB connection';}if(status!==previous){console.log(new Date().toISOString()+' '+status);previous=status;}}
connect();setInterval(connect,10000);
