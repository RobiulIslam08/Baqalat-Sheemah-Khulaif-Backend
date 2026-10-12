Set WshShell = CreateObject("WScript.Shell")

' Get the directory of the current script dynamically
Set objFSO = CreateObject("Scripting.FileSystemObject")
scriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Set current directory to project root
WshShell.CurrentDirectory = scriptDir

' Run the batch file in hidden mode (0)
' "cmd /c" runs the command and then terminates
WshShell.Run "cmd /c start-backend-server.bat", 0, False

Set WshShell = Nothing
Set objFSO = Nothing
