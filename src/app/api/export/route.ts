import {overview} from '@/lib/store';
export const runtime='nodejs';
export async function GET(){const data=overview(),rows=['time,node,people_present,vehicles_present,fps,crossing_occupied',...data.history.map(r=>[new Date(r.at).toISOString(),r.node_id,r.people,r.vehicles,r.fps,r.occupied].join(','))];return new Response(rows.join('\n'),{headers:{'Content-Type':'text/csv','Content-Disposition':'attachment; filename="swarmflow-torino.csv"'}});}
