# 파일명: scripts/run-opencode.ps1
# 생성일시: 2026-09-02
# 작성자: localManager 개발팀
# 목적: opencode CLI를 프로젝트 로컬(.opencode) 전용 데이터·캐시·상태·설정으로 격리 실행한다.
#       opencode 1.18.4 실측 결과, 데이터/캐시/상태 경로는 XDG_* 환경변수만 인식되고
#       OPENCODE_DATA_DIR 등 4종 변수는 무시되므로 XDG_* 를 설정한다. (R14, T-009 참조)
#       루트 .env 의 OPENCODE_API_KEY 를 Process 범위로 주입한다. (R15, T-008 참조)
#       프로젝트별 고정 포트를 --port 로 주입한다. -NoPort/-ServerPort 0 으로 비활성화하며,
#       포트가 이미 사용 중이면 경고 후 포트 없이(내부 RPC) 기동한다. (PORT-001 참조)
#       실행 전 로컬 설치 버전을 확인해 새 버전이 있으면 .opencode 에만 설치한다(전역 설치 미사용).
#       캐시 TTL 24시간·fail-open 이며 -NoUpdate / -CheckUpdate 로 제어한다. (PLAN-001 참조)
[CmdletBinding(PositionalBinding = $false)]
param(
    # 프로젝트별 고정 포트(PORT-001 배정표). 0 또는 -NoPort 이면 포트를 열지 않는다.
    # 이름을 -Port 로 두면 opencode 인자 '--port' 가 이 파라미터로 바인딩되므로 -ServerPort 로 둔다.
    [int]$ServerPort = 39739,
    [switch]$NoPort,
    [switch]$Check,
    [switch]$AuthLogin,
    [switch]$NoUpdate,
    [switch]$CheckUpdate,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$opencodeRoot = Join-Path $projectRoot '.opencode'
$env:OPENCODE_CONFIG_DIR = $opencodeRoot
$env:XDG_DATA_HOME = Join-Path $opencodeRoot 'data'
$env:XDG_CACHE_HOME = Join-Path $opencodeRoot 'cache'
$env:XDG_STATE_HOME = Join-Path $opencodeRoot 'state'

foreach ($directory in @($env:XDG_DATA_HOME, $env:XDG_CACHE_HOME, $env:XDG_STATE_HOME)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

# ── .env 로딩 (T-008 방식 A) ────────────────────────────────────────────────
# 프로젝트 루트 .env 를 읽어 KEY=VALUE 형태를 Process 범위 환경변수로 주입한다.
# 키는 파일에만 보관하고 소스 하드코딩을 금지한다. 값은 로그에 출력하지 않는다.
$envFile = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $envFile) {
    Get-Content -LiteralPath $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$') {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
        }
    }
}

$localCommand = Join-Path $opencodeRoot 'node_modules\.bin\opencode.cmd'
if ($Check) {
    # -Check 출력에 업데이트 관련 상태(설치 버전·캐시)를 함께 보여준다.
    $checkInstalledVersion = $null
    $checkPackagePath = Join-Path $opencodeRoot 'node_modules\opencode-ai\package.json'
    if (Test-Path -LiteralPath $checkPackagePath) {
        try { $checkInstalledVersion = (Get-Content -LiteralPath $checkPackagePath -Raw | ConvertFrom-Json).version } catch { }
    }
    $checkCachePath = Join-Path $opencodeRoot 'update-check.json'
    $checkCacheText = if (Test-Path -LiteralPath $checkCachePath) { (Get-Content -LiteralPath $checkCachePath -Raw).Trim() } else { '(없음)' }
    [pscustomobject]@{
        ProjectRoot = $projectRoot
        ConfigDirectory = $env:OPENCODE_CONFIG_DIR
        DataDirectory = $env:XDG_DATA_HOME
        CacheDirectory = $env:XDG_CACHE_HOME
        StateDirectory = $env:XDG_STATE_HOME
        LocalCommand = $localCommand
        LocalCommandExists = Test-Path $localCommand
        EnvFileExists = Test-Path -LiteralPath $envFile
        OpenCodeKeyLoaded = [bool]$env:OPENCODE_API_KEY
        InstalledOpenCodeVersion = $checkInstalledVersion
        UpdateCheckCache = $checkCacheText
        ServerPortDefault = $ServerPort
    } | Format-List
    exit 0
}

if (-not (Test-Path $localCommand)) {
    Write-Error "프로젝트 로컬 OpenCode가 없습니다: $localCommand`n'.opencode'에서 npm install을 먼저 실행하세요. 전역 실행 파일은 사용하지 않습니다."
    exit 1
}

# ── 자동 업데이트 확인 (PLAN-001 · 2026-11-04 전제 변경: 로컬만 갱신) ─────────
# 1) .opencode/update-check.json 캐시(성공 24시간, 실패 1시간)로 확인 빈도를 제한한다.
# 2) 새 버전이 있으면 .opencode 에만 설치한다(전역 설치는 사용하지 않는다).
# 3) 오프라인·설치 실패·실행 중 잠금 등 어떤 경우에도 기존 버전으로 실행한다(fail-open).
# 탈출구: -NoUpdate(확인 생략) / -CheckUpdate(확인만 하고 종료)

function Get-InstalledOpenCodeVersion {
    # 목적: 로컬 설치본 package.json 에서 실제 설치된 opencode-ai 버전을 읽는다.
    # 반환값: 버전 문자열 또는 미설치/파싱 실패 시 $null
    $packagePath = Join-Path $opencodeRoot 'node_modules\opencode-ai\package.json'
    if (-not (Test-Path -LiteralPath $packagePath)) { return $null }
    try { return (Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json).version } catch { return $null }
}

function Write-UpdateLog {
    # 목적: 업데이트 확인·설치 결과를 .opencode/logs/update-YYYYMMDD.log 에 탭 구분 1줄로 남긴다.
    param([string]$Message)
    try {
        $logDirectory = Join-Path $opencodeRoot 'logs'
        if (-not (Test-Path -LiteralPath $logDirectory)) {
            New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
        }
        $logPath = Join-Path $logDirectory ("update-" + (Get-Date -Format 'yyyyMMdd') + ".log")
        Add-Content -LiteralPath $logPath -Value ("{0}`t{1}" -f (Get-Date).ToString('o'), $Message) -Encoding utf8
    }
    catch {
        # 로그 기록 실패는 실행에 영향을 주지 않는다.
    }
}

function Test-OpenCodeRunning {
    # 목적: **이 프로젝트의** .opencode 바이너리를 사용 중인 opencode 프로세스가 있는지 확인한다.
    #       다른 프로젝트에서 실행 중인 세션 때문에 이 프로젝트 업데이트가 막히지 않도록 경로로 한정한다.
    $binaryPrefix = (Join-Path $opencodeRoot 'node_modules').ToLowerInvariant()
    foreach ($process in (Get-Process -Name 'opencode' -ErrorAction SilentlyContinue)) {
        try {
            $exePath = $process.Path
            if ($exePath -and $exePath.ToLowerInvariant().StartsWith($binaryPrefix)) { return $true }
        }
        catch {
            # 다른 사용자 소유 프로세스는 경로 조회가 거부될 수 있다 → 이 프로젝트 것으로 보지 않는다.
        }
    }
    return $false
}

if ($NoUpdate -and $CheckUpdate) {
    # 두 스위치가 충돌하면 '확인만'을 우선한다(설치는 하지 않는다).
    Write-Warning "[update] -NoUpdate 와 -CheckUpdate 를 함께 지정했습니다. 확인만 수행합니다."
    $NoUpdate = $false
}

if (-not $NoUpdate) {
    $installedVersion = Get-InstalledOpenCodeVersion
    $installedLabel = if ($installedVersion) { $installedVersion } else { '알수없음' }
    $npmCommand = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { 'npm.cmd' } else { 'npm' }
    $cachePath = Join-Path $opencodeRoot 'update-check.json'
    $cache = $null
    if (Test-Path -LiteralPath $cachePath) {
        try { $cache = Get-Content -LiteralPath $cachePath -Raw | ConvertFrom-Json } catch { $cache = $null }
    }

    # 캐시 유효기간: 성공 24시간, 실패 1시간(일시적 장애는 1시간 뒤 재시도)
    $cacheAge = [TimeSpan]::MaxValue
    if ($cache -and $cache.lastCheck) {
        try { $cacheAge = (Get-Date) - [datetime]$cache.lastCheck } catch { $cacheAge = [TimeSpan]::MaxValue }
    }
    $cacheTtl = if ($cache -and $cache.ok) { [TimeSpan]::FromHours(24) } else { [TimeSpan]::FromHours(1) }
    $useCache = (-not $CheckUpdate) -and ($cacheAge -lt $cacheTtl)

    $latestVersion = $null
    if ($useCache) {
        # 캐시 적중(성공 24시간 / 실패 1시간): 네트워크를 호출하지 않는다.
        $latestVersion = $cache.latest
    }
    else {
        try {
            # 오프라인 상황에서 오래 대기하지 않도록 재시도·타임아웃을 제한한다.
            $queryOutput = & $npmCommand view opencode-ai version --silent --fetch-retries=0 --fetch-timeout=8000 2>$null
            $candidate = @($queryOutput) | Where-Object { $_ -match '^\d+\.\d+\.\d+' } | Select-Object -First 1
            if ($candidate) { $latestVersion = $candidate.Trim() }
        }
        catch {
            $latestVersion = $null
        }

        $cacheObject = [pscustomobject]@{
            lastCheck = (Get-Date).ToString('o')
            latest    = $latestVersion
            ok        = [bool]$latestVersion
        }
        try { $cacheObject | ConvertTo-Json -Compress | Set-Content -LiteralPath $cachePath -Encoding utf8 } catch { }
        Write-UpdateLog ("check`tinstalled=$installedVersion latest=$latestVersion cache=miss")
    }

    # 버전 비교: '0.0.0-dev-...' 같은 비표준 태그는 [version] 변환이 실패하므로 방어적으로 처리한다.
    $parsedLatest = [version]'0.0.0'
    $parsedInstalled = [version]'0.0.0'
    $hasNewer = $false
    if ($latestVersion -and $installedVersion -and
        [version]::TryParse([string]$latestVersion, [ref]$parsedLatest) -and
        [version]::TryParse([string]$installedVersion, [ref]$parsedInstalled)) {
        $hasNewer = $parsedLatest -gt $parsedInstalled
    }

    if ($hasNewer) {
        if ($CheckUpdate) {
            Write-Host "[update] 새 버전 있습니다: $installedVersion -> $latestVersion (-CheckUpdate 이므로 설치하지 않음)"
        }
        elseif (Test-OpenCodeRunning) {
            Write-Warning "[update] 실행 중인 opencode 가 있어 업데이트를 건너뜁니다(기존 $installedVersion 실행)."
            Write-UpdateLog ("skip`tlock`tinstalled=$installedVersion latest=$latestVersion")
        }
        else {
            Write-Host "[update] 로컬 업데이트: $installedVersion -> $latestVersion"
            $installOutput = @()
            Push-Location $opencodeRoot
            try {
                # 출력은 화면에 흘리지 않고 모아 두었다가 실패 시 요약만 보여준다.
                $installOutput = @(& $npmCommand install "opencode-ai@$latestVersion" "@opencode-ai/plugin@$latestVersion" --workspaces=false --prefer-offline --no-audit --no-fund --save-exact 2>&1)
                $installExitCode = $LASTEXITCODE
            }
            finally {
                Pop-Location
            }
            $installTail = (@($installOutput | Where-Object { "$_".Trim() } | Select-Object -Last 3) -join ' / ')

            $verifiedVersion = Get-InstalledOpenCodeVersion
            if ($installExitCode -eq 0 -and $verifiedVersion -eq $latestVersion) {
                Write-Host "[update] 완료: $verifiedVersion"
                Write-UpdateLog ("local`t$installedVersion->$latestVersion`tverify=$verifiedVersion`tOK")
            }
            else {
                Write-Warning "[update] 로컬 업데이트 실패(종료코드 $installExitCode, 확인 버전 $verifiedVersion). 기존 버전으로 실행합니다."
                if ($installTail) { Write-Warning "[update] npm: $installTail" }
                Write-UpdateLog ("local`t$installedVersion->$latestVersion`tfail`texit=$installExitCode verify=$verifiedVersion`tmsg=$installTail")
            }
        }
    }
    elseif ($CheckUpdate) {
        if ($latestVersion) {
            Write-Host "[update] 최신 상태입니다: 설치 $installedLabel / 최신 $latestVersion"
        }
        else {
            Write-Warning "[update] 버전 확인 실패(오프라인 또는 레지스트리 응답 없음). 캐시: $cachePath"
            # 확인 실패는 스크립트 오류로 구분되도록 종료코드 1을 돌려준다.
            exit 1
        }
    }

    if ($CheckUpdate) { exit 0 }
}

$commandArguments = @()
if ($AuthLogin) {
    $commandArguments += 'auth'
    $commandArguments += 'login'
}
$commandArguments += $Arguments

# ── 포트 주입 (PORT-001) ────────────────────────────────────────────────────
# 프로젝트마다 다른 고정 포트를 사용해 다중 인스턴스 충돌을 방지한다.
# 주입 제외: -AuthLogin, -NoPort, $ServerPort 0, 사용자가 --port 를 직접 전달한 경우.
# 포트가 이미 사용 중이면 경고만 하고 포트 없이 실행한다(fail-open → TUI 내부 RPC 모드).
$userSuppliedPort = ($Arguments -contains '--port') -or [bool]($Arguments -like '--port=*')
if (-not $AuthLogin -and -not $NoPort -and $ServerPort -gt 0 -and -not $userSuppliedPort) {
    $portInUse = Get-NetTCPConnection -LocalPort $ServerPort -State Listen -ErrorAction SilentlyContinue
    if ($portInUse) {
        Write-Warning "포트 $ServerPort 사용 중(PID $($portInUse[0].OwningProcess)) → 포트 없이 실행합니다(내부 RPC 모드)."
    }
    else {
        $commandArguments += @('--port', "$ServerPort")
    }
}

Push-Location $projectRoot
try {
    & $localCommand @commandArguments
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
