param([ValidateSet("setup","start","stop","update")][string]$Action="start")
$ErrorActionPreference="Stop"
$projectPath=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectPath
try {
 $nodeCommand=Get-Command node -ErrorAction SilentlyContinue
 if(-not $nodeCommand){throw "Install Node.js 24 LTS from https://nodejs.org, then run Setup PCC Scheduling again."}
 $nodePath=$nodeCommand.Source
 $nodeMajor=[int]((& $nodePath -p "process.versions.node.split('.')[0]") | Select-Object -Last 1)
 if($nodeMajor -lt 24){throw "Node.js 24 or newer is required. Install Node.js 24 LTS from https://nodejs.org."}
 if($Action -eq "stop"){& $nodePath scripts/local-stop.mjs;if($LASTEXITCODE -ne 0){throw "The app could not be stopped."};exit}
 if($Action -eq "setup" -or $Action -eq "update"){
  $taskData=if($env:PCC_DATA_DIR){$env:PCC_DATA_DIR}else{Join-Path $env:LOCALAPPDATA "PCC Scheduling"}
  $runtimeFile=Join-Path $taskData "running.json"
  if(Test-Path -LiteralPath $runtimeFile){
   $runtime=Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json
   if(Get-Process -Id $runtime.pid -ErrorAction SilentlyContinue){throw "Save your work and run Stop PCC Scheduling before setup or updating."}
  }
  if($Action -eq "update"){
   if(-not (Test-Path -LiteralPath ".git")){throw "This is a ZIP download. Download the new repository ZIP into a new folder, then run Setup there. Your saved data stays in LocalAppData."}
   if(-not (Get-Command git -ErrorAction SilentlyContinue)){throw "Install Git or download the updated repository ZIP into a new folder."}
   $changes=& git status --porcelain
   if($LASTEXITCODE -ne 0 -or $changes){throw "This checkout has local changes. Keep them safe and update manually; nothing was overwritten."}
   & git pull --ff-only
   if($LASTEXITCODE -ne 0){throw "Git update failed. No data files were changed."}
  }
  & npm.cmd ci --no-audit --no-fund
  if($LASTEXITCODE -ne 0){throw "Dependency installation failed. Check your internet connection and rerun Setup."}
  & $nodePath scripts/local-build.mjs
  if($LASTEXITCODE -ne 0){throw "Build failed. Saved schedules are unchanged."}
  $shell=New-Object -ComObject WScript.Shell
  $shortcut=$shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath("Desktop")) "PCC Scheduling.lnk"))
  $shortcut.TargetPath=Join-Path $projectPath "Start PCC Scheduling.cmd"
  $shortcut.WorkingDirectory=$projectPath
  $shortcut.Save()
  Write-Host "Ready. Open PCC Scheduling from your Desktop. Setup requires internet; normal use does not."
 } else {
  if(-not (Test-Path -LiteralPath "dist-local/index.html")){throw "Run Setup PCC Scheduling first."}
  $taskData=if($env:PCC_DATA_DIR){$env:PCC_DATA_DIR}else{Join-Path $env:LOCALAPPDATA "PCC Scheduling"}
  New-Item -ItemType Directory -Path $taskData -Force | Out-Null
  $launchId=[Guid]::NewGuid().ToString("N").Substring(0,8)
  $errorLog=Join-Path $taskData ("launcher-"+$launchId+"-error.log")
  Start-Process -FilePath $nodePath -ArgumentList ('"'+(Join-Path $projectPath "scripts/local-start.mjs")+'"') -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskData ("launcher-"+$launchId+".log")) -RedirectStandardError $errorLog | Out-Null
  Start-Sleep -Seconds 2
  if(-not (Test-Path -LiteralPath (Join-Path $taskData "running.json"))){throw "The app did not start. See $errorLog."}
 }
} catch {Write-Host $_.Exception.Message -ForegroundColor Red;Read-Host "Press Enter to close";exit 1}
