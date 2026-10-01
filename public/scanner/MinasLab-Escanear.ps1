# MinasLab - Escaneador do PC (NAPS2 -> pasta do pedido no Drive)
# Chamado pelo botao "Escanear" do sistema atraves do endereco minaslab-scan://scan?pc=PC-28&t=<ticket>
# So aceita: numero de pedido PC-nn e um ticket de 15 min emitido pelo sistema. O destino do envio e fixo (abaixo).
param([string]$Url)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$Api    = 'https://reoghclxripktzpdwhiy.supabase.co/functions/v1/ml-sync'
$Perfil = 'MinasLab'          # nome do perfil criado no NAPS2 (pode ser trocado em config.ini: Perfil=Nome)
$Dpi    = 200
$cfg = Join-Path $PSScriptRoot 'config.ini'
if (Test-Path $cfg) { foreach ($l in Get-Content $cfg) { if ($l -match '^\s*Perfil\s*=\s*(.+?)\s*$') { $Perfil = $Matches[1] } elseif ($l -match '^\s*Dpi\s*=\s*(\d+)') { $Dpi = [int]$Matches[1] } } }
function Aviso($texto, $icone) { [void][System.Windows.Forms.MessageBox]::Show($texto, 'MinasLab - Escaneador', 'OK', $icone) }
try {
  if ($Url -notmatch '^minaslab-scan://scan\?(.+)$') { throw 'Chamada invalida.' }
  $q = @{}; foreach ($par in $Matches[1] -split '&') { $kv = $par -split '=', 2; if ($kv.Count -eq 2) { $q[$kv[0]] = [uri]::UnescapeDataString($kv[1]) } }
  $pc = $q['pc']; $token = $q['t']
  if ($pc -notmatch '^PC-\d+$') { throw 'Numero de pedido invalido.' }
  if ($token -notmatch '^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$') { throw 'Ticket invalido.' }
  $naps = @("$env:ProgramFiles\NAPS2\NAPS2.Console.exe", "${env:ProgramFiles(x86)}\NAPS2\NAPS2.Console.exe", "$env:LOCALAPPDATA\Programs\NAPS2\NAPS2.Console.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $naps) { throw 'NAPS2 nao encontrado neste PC. Instale o NAPS2 (naps2.com) e tente de novo.' }
  $nome = "ESCANEADO_${pc}_" + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.pdf'
  $saida = Join-Path ([IO.Path]::GetTempPath()) $nome
  $resp = [System.Windows.Forms.MessageBox]::Show("Coloque o documento do pedido $pc no scanner e clique em OK para escanear.`n(Perfil do NAPS2: $Perfil)", 'MinasLab - Escaneador', 'OKCancel', 'Information')
  if ($resp -ne 'OK') { return }
  & $naps -o $saida -p $Perfil --dpi $Dpi -f 2>&1 | Out-Null
  if (-not (Test-Path $saida) -or (Get-Item $saida).Length -lt 500) { throw "O NAPS2 nao gerou o arquivo. Confira se existe um perfil chamado '$Perfil' no NAPS2 apontando para o scanner deste PC." }
  $bytes = [IO.File]::ReadAllBytes($saida)
  if ($bytes.Length -gt 20MB) { throw 'O PDF passou de 20 MB. Diminua a resolucao no perfil do NAPS2.' }
  $corpo = @{ action = 'estoqueScanEnviar'; token = $token; pedidoCodigo = $pc; nomeOriginal = $nome; mimeType = 'application/pdf'; arquivoBase64 = [Convert]::ToBase64String($bytes) } | ConvertTo-Json -Compress
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  try { $r = Invoke-RestMethod -Uri $Api -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($corpo)) -TimeoutSec 180 }
  catch { $msg = $_.Exception.Message; try { $msg = ($_.ErrorDetails.Message | ConvertFrom-Json).erro } catch {}; throw "O sistema recusou o envio: $msg" }
  Remove-Item $saida -Force -ErrorAction SilentlyContinue
  Aviso "Documento enviado para a pasta do pedido $pc no Drive.`n$nome" 'Information'
} catch { Aviso ("Nao foi possivel escanear:`n" + $_.Exception.Message) 'Error' }
