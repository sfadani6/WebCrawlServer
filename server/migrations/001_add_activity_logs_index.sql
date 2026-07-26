-- 001_add_activity_logs_index
-- activity_logs 조회 성능 개선용 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_activity_logs_source ON activity_logs(source);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
