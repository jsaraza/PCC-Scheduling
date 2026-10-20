import Planner from "./team-planner";
import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from "./chatgpt-auth";
export const dynamic="force-dynamic";
export default async function Home(){const user=await getChatGPTUser();return <Planner user={user?.displayName||null} signIn={chatGPTSignInPath("/")} signOut={chatGPTSignOutPath("/")} />;}
