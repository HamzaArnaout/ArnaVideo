import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Opens a native Windows folder picker and returns the selected path.
 * Returns null if the user cancels.
 */
export async function pickFolderNative(initialDir?: string): Promise<string | null> {
  if (process.platform !== "win32") {
    throw new Error("Native folder picker is currently supported on Windows only.");
  }

  const start = (initialDir || "").replace(/'/g, "''");
  const script = `
Add-Type -AssemblyName System.Windows.Forms | Out-Null
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Select ArnaVideo output folder'
$dialog.ShowNewFolderButton = $true
if ('${start}') { try { $dialog.SelectedPath = '${start}' } catch {} }
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $dialog.SelectedPath) {
  Write-Output $dialog.SelectedPath
}
`;

  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
    {
      windowsHide: false,
      timeout: 300_000,
      maxBuffer: 1024 * 1024,
    },
  );

  const selected = stdout.trim();
  return selected || null;
}
