param(
  [string]$BaseUrl = 'http://localhost:3000/api/v1',
  [string]$AdminEmail = 'admin@guardian.com',
  [string]$AdminPassword = 'Admin@123',
  [string]$StudentEmail = 'student.smoke@guardian.local',
  [string]$StudentPassword = 'Student@123'
)

$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$jsonHeaders = @{ 'content-type' = 'application/json' }
$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$studentSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$adminEmail = $AdminEmail
$adminPassword = $AdminPassword
$studentEmail = $StudentEmail
$studentPassword = $StudentPassword

function Invoke-Login {
  param(
    [string]$Email,
    [string]$Password,
    [string]$Client,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session
  )

  $body = @{ email = $Email; password = $Password; client = $Client } | ConvertTo-Json
  return Invoke-RestMethod -Method Post -Uri "$base/auth/login" -Headers $jsonHeaders -Body $body -WebSession $Session
}

function Ensure-User {
  param(
    [string]$Name,
    [string]$Email,
    [string]$Password,
    [string]$Role
  )

  $payload = @{ name = $Name; email = $Email; password = $Password; role = $Role } | ConvertTo-Json
  try {
    Invoke-RestMethod -Method Post -Uri "$base/auth/register" -Headers $jsonHeaders -Body $payload | Out-Null
  } catch {
    $response = $_.Exception.Response
    if ($null -eq $response) { throw }
    if ($response.StatusCode.value__ -ne 500 -and $response.StatusCode.value__ -ne 409) { throw }
  }
}

try {
  $adminLogin = Invoke-Login -Email $adminEmail -Password $adminPassword -Client 'web' -Session $adminSession
} catch {
  throw "Admin login failed for '$adminEmail'. Provide valid -AdminEmail and -AdminPassword for this environment."
}

try {
  $studentLogin = Invoke-Login -Email $studentEmail -Password $studentPassword -Client 'mobile' -Session $studentSession
} catch {
  Ensure-User -Name 'Smoke Student' -Email $studentEmail -Password $studentPassword -Role 'STUDENT'
  $studentLogin = Invoke-Login -Email $studentEmail -Password $studentPassword -Client 'mobile' -Session $studentSession
}

$adminAccess = $adminLogin.access_token
$studentAccess = $studentLogin.access_token
if (-not $adminAccess) { throw 'Admin login failed: no access token returned.' }
if (-not $studentAccess) { throw 'Student login failed: no access token returned.' }

$adminAuthHeaders = @{ Authorization = "Bearer $adminAccess" }
$studentAuthHeaders = @{ Authorization = "Bearer $studentAccess" }

$overview = Invoke-RestMethod -Method Get -Uri "$base/dashboard/overview" -Headers $adminAuthHeaders
$students = Invoke-RestMethod -Method Get -Uri "$base/dashboard/students" -Headers $adminAuthHeaders
$wardens = Invoke-RestMethod -Method Get -Uri "$base/dashboard/wardens" -Headers $adminAuthHeaders
$attendance = Invoke-RestMethod -Method Get -Uri "$base/dashboard/attendance" -Headers $adminAuthHeaders
$logs = Invoke-RestMethod -Method Get -Uri "$base/dashboard/logs" -Headers $adminAuthHeaders
$requests = Invoke-RestMethod -Method Get -Uri "$base/dashboard/requests" -Headers $adminAuthHeaders
$notifications = Invoke-RestMethod -Method Get -Uri "$base/dashboard/notifications" -Headers $adminAuthHeaders
$reports = Invoke-RestMethod -Method Get -Uri "$base/dashboard/reports" -Headers $adminAuthHeaders
$settings = Invoke-RestMethod -Method Get -Uri "$base/dashboard/settings" -Headers $adminAuthHeaders
$profile = Invoke-RestMethod -Method Get -Uri "$base/dashboard/profile" -Headers $adminAuthHeaders

if ($notifications.items -and $notifications.items.Count -gt 0) {
  $notificationId = $notifications.items[0].id
  $markOne = Invoke-RestMethod -Method Post -Uri "$base/dashboard/notifications/$notificationId/read" -Headers $adminAuthHeaders
  $markOneState = if ($markOne) { 'ok' } else { 'failed' }
} else {
  $markOneState = 'skipped_no_notifications'
}

$markAll = Invoke-RestMethod -Method Post -Uri "$base/dashboard/notifications/read-all" -Headers $adminAuthHeaders

$qr = Invoke-RestMethod -Method Get -Uri "$base/qr/gate-token" -Headers $adminAuthHeaders
if (-not $qr.token) { throw 'QR token generation failed.' }

$scanBody = @{ token = $qr.token } | ConvertTo-Json
$scanHeaders = @{ Authorization = "Bearer $studentAccess"; 'content-type' = 'application/json' }
$scan = $null
try {
  $scan = Invoke-RestMethod -Method Post -Uri "$base/scan/submit" -Headers $scanHeaders -Body $scanBody
} catch {
  $response = $_.Exception.Response
  if ($null -eq $response) { throw }

  $body = $_.ErrorDetails.Message
  try {
    if (-not $body) {
      $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
      $body = $reader.ReadToEnd()
    }
  } catch {}

  $parsed = $null
  if ($body) {
    try { $parsed = $body | ConvertFrom-Json } catch {}
  }

  if ($parsed -and $parsed.requires_exit_details -eq $true) {
    $scanBodyWithExit = @{
      token = $qr.token
      exit_destination = 'Smoke Test Destination'
      exit_note = 'Smoke API validation'
    } | ConvertTo-Json
    $scan = Invoke-RestMethod -Method Post -Uri "$base/scan/submit" -Headers $scanHeaders -Body $scanBodyWithExit
  } else {
    throw
  }
}

$traceRequestId = $scan.request_id
if (-not $traceRequestId) { throw 'Scan response missing request_id for trace lookup.' }
$trace = Invoke-RestMethod -Method Get -Uri "$base/dashboard/request-trace?request_id=$traceRequestId" -Headers $adminAuthHeaders

$refresh = Invoke-RestMethod -Method Post -Uri "$base/auth/refresh" -Headers $jsonHeaders -WebSession $adminSession
$logout = Invoke-RestMethod -Method Post -Uri "$base/auth/logout" -Headers $jsonHeaders -WebSession $adminSession

$result = [ordered]@{
  loginAdmin = [bool]$adminAccess
  loginStudent = [bool]$studentAccess
  overview = [bool]$overview
  students = [bool]$students
  wardens = [bool]$wardens
  attendance = [bool]$attendance
  logs = [bool]$logs
  requests = [bool]$requests
  notifications = [bool]$notifications
  reports = [bool]$reports
  settings = [bool]$settings
  profile = [bool]$profile
  traceCount = @($trace.items).Count
  markOne = $markOneState
  markAll = [bool]$markAll
  qrIssued = [bool]$qr.token
  scanAccepted = [bool]$scan.success
  refresh = [bool]$refresh.access_token
  logout = [bool]$logout.success
}

$result | ConvertTo-Json -Depth 6
