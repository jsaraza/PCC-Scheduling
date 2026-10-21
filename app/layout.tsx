import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:"Patient Care Coordinator Scheduler",description:"Patient Care Coordinator Scheduler for nurse assignments, team coverage, and coordinator review.",icons:{icon:[{url:"/pcc-icon.svg",type:"image/svg+xml"},{url:"/pcc-icon-32.png",type:"image/png",sizes:"32x32"}],apple:[{url:"/apple-touch-icon.png",sizes:"180x180"}]}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
