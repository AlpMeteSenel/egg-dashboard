import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {TransitStop} from './types';
let saved:{source:string;as_of:string;stops:TransitStop[]}|undefined;
export function stopCatalog(){return saved??=JSON.parse(readFileSync(join(process.cwd(),'data/turin-stops.json'),'utf8')) as NonNullable<typeof saved>;}
export function stopByID(id:string){return stopCatalog().stops.find(s=>s.id===id)||null;}
