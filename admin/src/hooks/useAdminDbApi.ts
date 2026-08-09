// admin/src/hooks/useAdminDbApi.ts

import { useState, useCallback } from 'react';
import { Client, CrawlLog, WorkerRecord, CustomFieldDef, ConfigEntry } from '../types/index.js';
import {
  fetchClientsApi,
  updateClientConfigApi,
  fetchWorkersApi,
  createWorkerApi,
  fetchLogsApi,
  clearLogsApi,
  purgeClientApi,
  fetchConfigsApi,
  updateConfigValueApi
} from '../services/apiService.js';

/**
 * 관리자 대시보드의 REST API 통신 및 전체 상태 관리 비즈니스 로직 훅입니다.
 * 클라이언트 목록, 워커 목록, 수집 로그에 대한 CRUD 및 관리 작업을 제공합니다.
 */
export function useAdminDbApi() {
  /** 수집 노드 클라이언트 목록 상태 */
  const [clients, setClients] = useState<Client[]>([]);
  /** 수집 워커 목록 상태 */
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  /** 크롤링 수집 로그 목록 상태 */
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  /** 시스템 환경 설정(configs) 목록 상태 */
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);

  /**
   * 백엔드로부터 클라이언트 목록을 인출하여 상태를 갱신합니다.
   *
   * @param onlineOnly - true 지정 시 온라인 노드만 인출 (기본값: false)
   */
  const loadClients = useCallback(async (onlineOnly: boolean = false) => {
    try {
      const data = await fetchClientsApi(onlineOnly);
      setClients(data);
    } catch {
      // API 통신 예외 스킵
    }
  }, []);

  /**
   * 백엔드로부터 수집 워커 목록을 인출하여 상태를 갱신합니다.
   */
  const loadWorkers = useCallback(async () => {
    try {
      const data = await fetchWorkersApi();
      setWorkers(data);
    } catch {
      // API 통신 예외 스킵
    }
  }, []);

  /**
   * 백엔드로부터 최근 수집 로그 목록을 인출하여 상태를 갱신합니다.
   */
  const loadLogs = useCallback(async () => {
    try {
      const data = await fetchLogsApi();
      setLogs(data);
    } catch {
      // API 통신 예외 스킵
    }
  }, []);

  /**
   * 백엔드로부터 시스템 환경 설정(configs) 목록을 인출하여 상태를 갱신합니다.
   */
  const loadConfigs = useCallback(async () => {
    try {
      const data = await fetchConfigsApi();
      setConfigs(data);
    } catch {
      // API 통신 예외 스킵
    }
  }, []);

  /**
   * 특정 환경 설정 항목의 값을 수정하고 목록을 재조회합니다.
   *
   * @param key - 변경할 설정 변수명
   * @param value - 새 설정 값
   * @returns 성공 여부
   */
  const executeUpdateConfig = useCallback(async (
    key: string,
    value: string
  ) => {
    const success = await updateConfigValueApi(key, value);
    if (success) {
      await loadConfigs();
      return true;
    }
    return false;
  }, [loadConfigs]);

  /**
   * 특정 노드의 환경설정(별칭)을 업데이트합니다.
   *
   * @param clientId - 대상 노드 UUID
   * @param alias - 노드 한글 별칭
   * @returns 성공 여부
   */
  const executeUpdateClientConfig = useCallback(async (
    clientId: string,
    alias: string
  ) => {
    const success = await updateClientConfigApi(clientId, alias);
    if (success) {
      await loadClients();
      return true;
    }
    return false;
  }, [loadClients]);

  /**
   * 신규 동적 수집 워커 및 타깃 DB 스키마를 빌드합니다.
   *
   * @param params - 워커 생성 파라미터 객체
   * @returns 성공 여부
   */
  const executeCreateWorker = useCallback(async (params: {
    workerId: string;
    workerName: string;
    dbFileName: string;
    tableName: string;
    storageRootPath: string;
    customFields: CustomFieldDef[];
  }) => {
    const success = await createWorkerApi(params);
    if (success) {
      alert('신규 수집 워커 및 타깃 DB 스키마가 성공적으로 빌드되었습니다.');
      await loadWorkers();
      return true;
    }
    return false;
  }, [loadWorkers]);

  /**
   * 데이터베이스의 모든 수집 로그를 일괄 소거합니다.
   * 실행 전 사용자 확인을 요구합니다.
   *
   * @returns 성공 여부
   */
  const executeClearLogs = useCallback(async () => {
    if (!confirm('데이터베이스 내의 모든 크롤링 수집 로그를 완전 소거하시겠습니까?')) {
      return false;
    }
    const success = await clearLogsApi();
    if (success) {
      alert('데이터베이스의 모든 수집 로그가 일괄 소거되었습니다.');
      await loadLogs();
      return true;
    }
    return false;
  }, [loadLogs]);

  /**
   * 지정된 클라이언트 기기를 강제 차단 추방합니다.
   * 실행 전 사용자 확인을 요구합니다.
   *
   * @param clientId - 추방할 클라이언트 UUID
   * @returns 성공 여부
   */
  const executePurgeClient = useCallback(async (clientId: string) => {
    if (!confirm(`대상 클라이언트 [${clientId}]를 강제 정화 격리하시겠습니까?`)) {
      return false;
    }
    const success = await purgeClientApi(clientId);
    if (success) {
      alert('지정된 클라이언트 기기가 완전히 차단 제거되었습니다.');
      await loadClients();
      await loadLogs();
      return true;
    }
    return false;
  }, [loadClients, loadLogs]);

  /**
   * 연결 끊긴 오프라인 노드 이력을 일괄 정화합니다.
   * 실행 전 사용자 확인을 요구합니다.
   *
   * @returns 성공 여부
   */
  const executePurgeOfflineClients = useCallback(async () => {
    const offlineClients = clients.filter((c) => !c.is_online);
    if (offlineClients.length === 0) {
      alert('정리할 오프라인 노드 이력이 없습니다.');
      return false;
    }

    if (!confirm(`연결 끊긴 오프라인 노드 ${offlineClients.length}개를 일괄 정화하시겠습니까?`)) {
      return false;
    }

    // 오프라인 노드 순차 정화
    for (const client of offlineClients) {
      await purgeClientApi(client.client_id);
    }

    alert('모든 오프라인 노드 이력이 정화되었습니다.');
    await loadClients();
    await loadLogs();
    return true;
  }, [clients, loadClients, loadLogs]);

  return {
    clients,
    workers,
    logs,
    configs,
    setLogs,
    loadClients,
    loadWorkers,
    loadLogs,
    loadConfigs,
    executeUpdateConfig,
    executeUpdateClientConfig,
    executeCreateWorker,
    executeClearLogs,
    executePurgeClient,
    executePurgeOfflineClients
  };
}
