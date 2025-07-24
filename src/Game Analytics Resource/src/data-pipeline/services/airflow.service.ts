import { Injectable, Logger } from "@nestjs/common"
import axios from "axios"

export interface DAGRun {
  dagId: string
  runId: string
  state: string
  executionDate: string
  startDate: string
  endDate?: string
}

export interface TaskInstance {
  taskId: string
  dagId: string
  runId: string
  state: string
  startDate: string
  endDate?: string
  duration?: number
}

@Injectable()
export class AirflowService {
  private readonly logger = new Logger(AirflowService.name)
  private readonly airflowUrl: string
  private readonly auth: { username: string; password: string }

  constructor() {
    this.airflowUrl = process.env.AIRFLOW_URL || "http://localhost:8080"
    this.auth = {
      username: process.env.AIRFLOW_USERNAME || "admin",
      password: process.env.AIRFLOW_PASSWORD || "admin",
    }
  }

  async triggerDAG(dagId: string, conf: Record<string, any> = {}): Promise<DAGRun> {
    try {
      const response = await axios.post(
        `${this.airflowUrl}/api/v1/dags/${dagId}/dagRuns`,
        {
          conf,
          dag_run_id: `manual_${Date.now()}`,
        },
        {
          auth: this.auth,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )

      this.logger.log(`Triggered DAG ${dagId} with run ID ${response.data.dag_run_id}`)
      return this.mapDAGRun(response.data)
    } catch (error) {
      this.logger.error(`Failed to trigger DAG ${dagId}`, error)
      throw error
    }
  }

  async getDAGRuns(dagId: string, limit = 10): Promise<DAGRun[]> {
    try {
      const response = await axios.get(`${this.airflowUrl}/api/v1/dags/${dagId}/dagRuns`, {
        auth: this.auth,
        params: { limit },
      })

      return response.data.dag_runs.map(this.mapDAGRun)
    } catch (error) {
      this.logger.error(`Failed to get DAG runs for ${dagId}`, error)
      throw error
    }
  }

  async getTaskInstances(dagId: string, runId: string): Promise<TaskInstance[]> {
    try {
      const response = await axios.get(`${this.airflowUrl}/api/v1/dags/${dagId}/dagRuns/${runId}/taskInstances`, {
        auth: this.auth,
      })

      return response.data.task_instances.map(this.mapTaskInstance)
    } catch (error) {
      this.logger.error(`Failed to get task instances for ${dagId}/${runId}`, error)
      throw error
    }
  }

  async pauseDAG(dagId: string): Promise<void> {
    try {
      await axios.patch(
        `${this.airflowUrl}/api/v1/dags/${dagId}`,
        { is_paused: true },
        {
          auth: this.auth,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )

      this.logger.log(`Paused DAG ${dagId}`)
    } catch (error) {
      this.logger.error(`Failed to pause DAG ${dagId}`, error)
      throw error
    }
  }

  async unpauseDAG(dagId: string): Promise<void> {
    try {
      await axios.patch(
        `${this.airflowUrl}/api/v1/dags/${dagId}`,
        { is_paused: false },
        {
          auth: this.auth,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )

      this.logger.log(`Unpaused DAG ${dagId}`)
    } catch (error) {
      this.logger.error(`Failed to unpause DAG ${dagId}`, error)
      throw error
    }
  }

  private mapDAGRun(data: any): DAGRun {
    return {
      dagId: data.dag_id,
      runId: data.dag_run_id,
      state: data.state,
      executionDate: data.execution_date,
      startDate: data.start_date,
      endDate: data.end_date,
    }
  }

  private mapTaskInstance(data: any): TaskInstance {
    return {
      taskId: data.task_id,
      dagId: data.dag_id,
      runId: data.dag_run_id,
      state: data.state,
      startDate: data.start_date,
      endDate: data.end_date,
      duration: data.duration,
    }
  }
}
