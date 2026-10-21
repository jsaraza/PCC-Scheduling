param([ValidateSet("start","stop","shortcut")][string]$Action="start")
$ErrorActionPreference="Stop"
$projectPath=Split-Path -Parent $PSScriptRoot
$nodePath=Join-Path $projectPath "runtime\node.exe"
Set-Location -LiteralPath $projectPath
try {
 if(-not (Test-Path -LiteralPath $nodePath)){throw "Extract the complete PCC Scheduler Portable ZIP first. The bundled runtime folder is missing."}
 if($Action -eq "shortcut"){
  $shell=New-Object -ComObject WScript.Shell
  $shortcut=$shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath("Desktop")) "PCC Scheduler.lnk"))
  $shortcut.TargetPath=Join-Path $projectPath "Open PCC Scheduler.cmd"
  $shortcut.WorkingDirectory=$projectPath
  $shortcut.IconLocation=(Join-Path $projectPath "public\pcc-icon.ico")+",0"
  $shortcut.Description="Patient Care Coordinator Scheduler"
  $shortcut.Save()
  Write-Host "Desktop shortcut created. Keep this extracted folder in its current location."
  exit 0
 }
 if($Action -eq "stop"){
  & $nodePath scripts/local-stop.mjs
  if($LASTEXITCODE -ne 0){throw "The app could not be stopped. It may already be closed."}
  exit 0
 }
 if(-not (Test-Path -LiteralPath "dist-local/index.html")){throw "The app files are incomplete. Extract the complete Portable ZIP again."}
 $taskData=if($env:PCC_DATA_DIR){$env:PCC_DATA_DIR}else{Join-Path $env:LOCALAPPDATA "PCC Scheduling"}
 New-Item -ItemType Directory -Path $taskData -Force | Out-Null
 $launchId=[Guid]::NewGuid().ToString("N").Substring(0,8)
 $errorLog=Join-Path $taskData ("launcher-"+$launchId+"-error.log")
 $child=Start-Process -FilePath $nodePath -ArgumentList ('"'+(Join-Path $projectPath "scripts/local-start.mjs")+'"') -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskData ("launcher-"+$launchId+".log")) -RedirectStandardError $errorLog
 # Retain the process handle so Windows PowerShell can read a fast reconnect's exit code.
 $null=$child.Handle
 $runtimeFile=Join-Path $taskData "running.json"
 for($attempt=0;$attempt -lt 40;$attempt++){
  Start-Sleep -Milliseconds 250
  $child.Refresh()
  if($child.HasExited){$child.WaitForExit();if($child.ExitCode -eq 0){exit 0};throw "Startup failed. See $errorLog."}
  if(Test-Path -LiteralPath $runtimeFile){
   try{$runtime=Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json;if($runtime.pid -eq $child.Id){exit 0}}catch{}
  }
 }
 throw "Startup is taking longer than expected. See $errorLog before trying again."
}catch{
 Write-Host $_.Exception.Message -ForegroundColor Red
 if($env:PCC_NO_PAUSE -ne "1"){Read-Host "Press Enter to close" | Out-Null}
 exit 1
}
