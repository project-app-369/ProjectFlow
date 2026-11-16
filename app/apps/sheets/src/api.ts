import { isEffective } from '../../api/src/registry/catalog';
import { AdminService } from './admin-service';
import { FacilitiesService } from './facilities-service';
import { InterfacesService } from './interfaces-service';
import { RegistersService } from './registers-service';
import { RisksService } from './risks-service';
import { Service } from './service';
import { BudgetService } from './budget-service';
import { IssuesService } from './issues-service';
import { KnowledgeService } from './knowledge-service';
import { noMailer, type Mailer } from './mailer';
import { ProcurementOps } from './procurement-ops';
import { SnapshotsService } from './snapshots-service';
import { TasksService } from './tasks-service';
import type { Store } from './store';

/** The three services behind the routes, sharing one store and clock. */
export class Api {
  readonly svc: Service;
  readonly admin: AdminService;
  readonly reg: RegistersService;
  readonly tasks: TasksService;
  readonly snapshots: SnapshotsService;
  readonly budget: BudgetService;
  readonly knowledge: KnowledgeService;
  readonly proc: ProcurementOps;
  readonly issues: IssuesService;
  readonly risks: RisksService;
  readonly interfaces: InterfacesService;
  readonly facilities: FacilitiesService;

  constructor(store: Store, clock: () => Date = () => new Date(), mailer: Mailer = noMailer) {
    this.svc = new Service(store, clock);
    this.admin = new AdminService(this.svc);
    this.reg = new RegistersService(this.svc);
    this.tasks = new TasksService(this.svc);
    this.snapshots = new SnapshotsService(this.svc);
    this.budget = new BudgetService(this.svc);
    this.knowledge = new KnowledgeService(this.svc);
    this.proc = new ProcurementOps(this.svc);
    this.issues = new IssuesService(this.svc, mailer);
    this.risks = new RisksService(this.svc);
    this.interfaces = new InterfacesService(this.svc);
    this.facilities = new FacilitiesService(this.svc, this.reg);
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
      risks: on('management.risks') ? this.risks.summary(projectId) : null,
      interfaces: on('interface.register') ? this.interfaces.interfaceSummary(projectId) : null,
    };
  }
}
