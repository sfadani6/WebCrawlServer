/**
 * WebCrawlServer PM2 Configuration
 * 
 * PM2 프로세스 매니저 설정 파일
 * 로컬 설치된 PM2 사용: npx pm2
 * 
 * 사용법:
 *   npm install          # 의존성 설치 (pm2 포함)
 *   npx pm2 start       # 서버 시작
 *   npx pm2 list        # 프로세스 목록
 *   npx pm2 logs        # 로그 확인
 *   npx pm2 stop        # 서버 중지
 */

module.exports = {
  /**
   * 애플리케이션 배열
   * 여러 인스턴스를 실행할 수 있지만, 개발 환경에서는 1개만 실행
   */
  apps: [
    {
      name: 'WebCrawlServer',           // 애플리케이션 이름
      script: './server/app.js',        // 진입점 파일
      
      // 인스턴스 설정
      instances: 1,                      // 인스턴스 수 (클러스터 모드 시 CPU 코어 수)
      exec_mode: 'fork',                // fork 모드 (클러스터: 'cluster')
      
      // 환경 변수
      env: {
        NODE_ENV: 'production',         // 실행 환경
        PORT: 9600,                     // 기본 포트
      },
      
      // 개발 환경 설정 (별도로 정의)
      env_dev: {
        NODE_ENV: 'development',
        PORT: 9600,
      },
      
      //테스트 환경 설정
      env_test: {
        NODE_ENV: 'test',
        PORT: 9601,
      },
      
      // PM2 로그 설정
      output: './logs/pm2-out.log',      // 표준 출력 로그 파일
      error: './logs/pm2-error.log',    // 에러 로그 파일
      
      // 로그 날짜 포맷
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      
      // 에러 로그 파일 크기 제한 (KB)
      max_memory_restart: '1G',         // 메모리 제한 (1GB)
      
      // 자동 재시작 설정
      watch: false,                     // 파일 변경 감시 (개발 시 true)
      ignore_watch: [
        'node_modules',
        'logs',
        'database',
        'public'
      ],
      
      // 재시작 불안정성 방지
      max_restarts: 10,                 // 최대 재시작 횟수
      min_uptime: '5s',                 // 최소 안정 시간
      
      // 크래시 시 재시작 지연
      restart_delay: 1000,              // 1초 지연
      
      // 프로세스 우선순위
      priority: 10,
      
      // CPU/메모리 사용할 수 있는 한도
      cpu_limit: 90,                   // CPU 90% 이상 사용 시 재시작
      memory_limit: '1.5G',            // 메모리 1.5GB 이상 사용 시 재시작
    }
  ],
  
  /**
   * 배포 설정 (미래 사용)
   */
  deploy: {
    production: {
      user: 'node',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'your-repo-url',
      path: '/var/www/WebCrawlServer',
      'pre-deploy': 'npm install --production',
      'post-deploy': 'npx pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
