# Local verification only. No deploy, provider traffic, secrets or live data.
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $repoRoot
function Invoke-Check {
  param([string]$Executable, [string[]]$CheckArguments)
  & $Executable @CheckArguments
  if ($LASTEXITCODE -ne 0) { throw "Check failed: $Executable $($CheckArguments -join ' ')" }
}
Invoke-Check 'node' @('--test',
  'apps/api/test/integration/shop-requests.test.mjs',
  'apps/api/test/integration/whatsapp-stage2.test.mjs',
  'apps/api/test/integration/delivery-recovery.test.mjs',
  'apps/api/test/integration/fidel-manual-spend.test.mjs',
  'apps/api/test/integration/fidel-supabase-spend.test.mjs',
  'apps/api/test/integration/fidel-spend-tiers.test.mjs')
Invoke-Check 'node' @('--test',
  'supabase/functions/_shared/whatsapp-bot.test.mjs',
  'supabase/functions/_shared/whatsapp-messages.test.mjs',
  'supabase/functions/_shared/whatsapp-shops.test.mjs',
  'supabase/functions/_shared/push.test.mjs',
  'tmp/whatsapp-independent.test.mjs')
$denoCommand = Get-Command deno -ErrorAction SilentlyContinue
if ($denoCommand) { $denoExecutable = $denoCommand.Source } else {
  $denoExecutable = Join-Path $env:LOCALAPPDATA 'npm-cache/_npx/05b6ef7b13673c57/node_modules/@deno/win32-x64/deno.exe'
  if (-not (Test-Path -LiteralPath $denoExecutable)) { throw 'Deno is required; put an installed runtime on PATH.' }
}
Invoke-Check $denoExecutable @('check','--no-config','--node-modules-dir=none',
  'supabase/functions/whatsapp-webhook/index.ts',
  'supabase/functions/whatsapp-dispatch/index.ts',
  'supabase/functions/shop-request-search/index.ts',
  'supabase/functions/shop-request-notify/index.ts',
  'supabase/functions/send-user-push/index.ts',
  'supabase/functions/delete-my-account/index.ts',
  'supabase/functions/platform-health/index.ts')
Invoke-Check 'node' @('node_modules/typescript/bin/tsc','--noEmit','-p','apps/shopper/tsconfig.json')
Invoke-Check 'node' @('node_modules/typescript/bin/tsc','--noEmit','-p','apps/retailer/tsconfig.json')
Invoke-Check 'node' @('apps/web/node_modules/typescript/bin/tsc','--noEmit','-p','apps/web/tsconfig.app.json')
Invoke-Check 'node' @('node_modules/typescript/bin/tsc','--noEmit','-p','apps/admin/tsconfig.json')
Invoke-Check 'git' @('diff','--check')
Write-Output 'PASS: 31 database/fake-provider/recovery tests, 23 pure/independent tests, seven Deno entrypoints, four app type checks and diff check.'
