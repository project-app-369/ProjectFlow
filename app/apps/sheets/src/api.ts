import { isEffective } from '../../api/src/registry/catalog';
import { AdminService } from './admin-service';
import { RegistersService } from './registers-service';
import { Service } from './service';
import { TasksService } from './tasks-service';
import type { Store } from './store';

/** The three services behind the routes, sharing one store and clock. */
export class Api {
  readonly svc: Service;
  readonly admin: AdminService;
  readonly reg: RegistersService;
  readonly tasks: TasksService;

  constructor(store: Store, clock: () => Date = () => new Date()) {
    this.svc = new Service(store, clock);
    this.admin = new AdminService(this.svc);
    this.reg = new RegistersService(this.svc);
    this.tasks = new TasksService(this.svc);
  }

  /**
   * Dashboard widgets draw on other modules. A widget whose source module is off comes back as null,
   * so the client can show an explicit unavailable state (spec §6.1 acceptance).
   */
  dashboard(projectId: string) {
    const project = this.svc.project(projectId);
    const states = this.svc.states(projectId);
    const on = (key: string) => isEffective(key, states);
    return {
      project,
      overallProgress: on('planning.overall-progress') ? this.svc.overall(projectId) : null,
      workPackages: on('planning.work-packages') ? this.svc.workPackages(projectId) : null,
      procurement: on('procurement.procurement-plan') ? this.svc.procurementSummary(projectId) : null,
      expediting: on('procurement.expediting.vendor-overview') ? this.svc.expeditingSummary(projectId) : null,
      milestones: on('planning.milestones') ? this.reg.milestoneSummary(projectId) : null,
      risks: on('management.risks') ? this.reg.riskSummary(projectId) : null,
      interfaces: on('interface.register') ? this.reg.interfaceSummary(projectId) : null,
    };
  }
}
