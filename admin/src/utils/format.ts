// admin/src/utils/format.ts

/**
 * 바이트 단위 수치를 사람이 읽기 쉬운 용량 문자열로 변환합니다.
 *
 * @param bytes - 변환할 바이트 수
 * @returns 변환된 용량 문자열 (예: "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/**
 * ISO 문자열 또는 숫자 타임스탬프를 현지 시각 문자열로 변환합니다.
 *
 * @param value - ISO 문자열 또는 밀리초 타임스탬프
 * @returns 현지 시각 문자열
 */
export function formatDateTime(value: string | number): string {
  const date = new Date(typeof value === "number" ? value : value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}
