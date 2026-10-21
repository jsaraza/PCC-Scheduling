import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:"Patient Care Coordinator Scheduler",description:"Patient Care Coordinator Scheduler for nurse assignments, team coverage, and coordinator review.",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
