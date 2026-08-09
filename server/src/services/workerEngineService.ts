// server/src/services/workerEngineService.ts

import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { WorkerRecord, CustomFieldDef } from "../database.js";

// ESM 환경에서 __dirname 대체 경로 계산
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 유입 수집 패킷을 담당 워커의 스키마 정의에 맞춰 타깃 DB 및 테이블에 동적으로 인서트합니다.
 * 워커가 지정한 DB 파일을 열고, 커스텀 필드 값을 페이로드로부터 추출하여 INSERT 구문을 동적 구성합니다.
 *
 * @param workerConfig - 담당 워커 레코드 (DB 경로, 테이블명, 스키마 JSON 포함)
 * @param clientId - 수집 노드 UUID
 * @param domain - 수집 도메인
 * @param filePath - 저장된 HTML 물리 파일 경로
 * @param fileSize - 저장된 파일 크기 (Bytes)
 * @param packetPayload - 수집 패킷 페이로드 객체
 */
export function executeWorkerPipeline(
  workerConfig: WorkerRecord,
  clientId: string,
  domain: string,
  filePath: string,
  fileSize: number,
  packetPayload: Record<string, unknown>
): void {
  // 워커가 지정한 DB 파일 절대 경로 계산
  // 컴파일 결과가 dist/services/ 하위에 위치하므로 3단계 위로 이동하여 프로젝트 루트 기준으로 해석합니다.
  const targetDbPath = resolve(
    __dirname,
    "..",
    "..",
    "..",
    workerConfig.db_file_path
  );

  // 타깃 워커 DB 인스턴스 열기
  const targetDb = new Database(targetDbPath);

  // 워커 스키마 JSON에서 커스텀 필드 정의 배열 파싱
  const customFields: CustomFieldDef[] = JSON.parse(
    workerConfig.schema_json || "[]"
  );

  // 기본 컬럼 및 값 목록 초기화
  let cols = "client_id, domain, url, title, file_path, file_size, timestamp";
  let vals = "?, ?, ?, ?, ?, ?, ?";
  const paramValues: unknown[] = [
    clientId,
    domain,
    packetPayload.url || "",
    packetPayload.title || "",
    filePath,
    fileSize,
    Date.now(),
  ];

  // 커스텀 스키마 필드에 해당하는 페이로드 값 동적 추가
  for (const field of customFields) {
    cols += `, ${field.name}`;
    vals += `, ?`;
    paramValues.push(packetPayload[field.name] ?? null);
  }

  // 동적 INSERT 구문 실행
  const query = `INSERT INTO ${workerConfig.table_name} (${cols}) VALUES (${vals})`;
  targetDb.prepare(query).run(...paramValues);
}
