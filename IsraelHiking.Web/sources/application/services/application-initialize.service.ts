import { Injectable } from "@angular/core";
import { MatDialog } from "@angular/material";

import { LoggingService } from "./logging.service";
import { ScreenService } from "./screen.service";
import { DatabaseService } from "./database.service";
import { ApplicationExitService } from "./application-exit.service";
import { OpenWithService } from "./open-with.service";
import { PurchaseService } from "./purchase.service";
import { UseAppDialogComponent } from "../components/dialogs/use-app-dialog.component";
import { RunningContextService } from "./running-context.service";

@Injectable()
export class ApplicationInitializeService {
    constructor(private readonly dialog: MatDialog,
                private readonly loggingService: LoggingService,
                private readonly screenService: ScreenService,
                private readonly databaseService: DatabaseService,
                private readonly applicationExitService: ApplicationExitService,
                private readonly openWithService: OpenWithService,
                private readonly purchaseService: PurchaseService,
                private readonly runnincContextService: RunningContextService) {
    }

    public async initialize() {
        try {
            await this.loggingService.initialize();
            alert("logging init end");
            await this.loggingService.info("Starting IHM Application Initialization");
            this.screenService.initialize();
            alert("screen service init end");
            await this.databaseService.initialize();
            alert("database init end");
            this.applicationExitService.initialize();
            alert("exit service init end");
            this.openWithService.initialize();
            alert("open with init end");
            this.purchaseService.initialize();
            alert("purchase service init end");
            if (this.runnincContextService.isMobile
                && !this.runnincContextService.isCordova
                && !this.runnincContextService.isIFrame) {
                UseAppDialogComponent.openDialog(this.dialog);
            }
            await this.loggingService.info("Finished IHM Application Initialization");
        } catch (ex) {
            if (ex.toString().indexOf("A mutation operation was attempted on a database that did not allow mutations") !== -1) {
                alert("Sorry, this site does not support running FireFox in private mode...");
            } else {
                alert(`alert("Ooopppss... Any chance you can take a screenshot and send it to israelhikingmap@gmail.com?` +
                    `\nInit failed: ${ex.toString()}`);
            }
            this.loggingService.error(`Failed IHM Application Initialization: ${ex.toString()}`);
        }
    }
}
