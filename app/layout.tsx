import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:"Alvins Slave  Pre-op assignments",description:"Thoughtful daily assignments. A pre-op nurse planner with coordinator review.",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
