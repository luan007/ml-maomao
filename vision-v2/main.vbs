Set WshShell = WScript.CreateObject("WScript.Shell")

WshShell.appactivate("Compute Node")
WshShell.sendkeys "{ENTER}"

WScript.Sleep 3000
WshShell.SendKeys "Ctrl ^"
WScript.Sleep 1000
WshShell.SendKeys "Shift +"
WScript.Sleep 1000
WshShell.SendKeys "^r"

WshShell.appactivate("MAOMAO")
WshShell.sendkeys "{ENTER}"