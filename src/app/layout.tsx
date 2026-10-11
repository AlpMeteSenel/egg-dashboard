import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'SWARMFLOW — Torino live',description:'A clear view of movement, crossings and public transport in Turin.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
