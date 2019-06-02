/// <reference types="cordova-plugin-file" />
import { Injectable, NgZone } from "@angular/core";

import { RunningContextService } from "./running-context.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { DatabaseService } from "./database.service";
import { ToastService } from "./toast.service";

declare var navigator: Navigator;
declare var cordova: any;
declare var window: Window;

declare type ExitState = "None" | "FirstClick" | "SecondClick"

interface Navigator {
    app: any;
}

interface Window {
    resolveLocalFileSystemURL: Function;
}

@Injectable()
export class ApplicationExitService {
    private state: ExitState;

    constructor(private readonly resources: ResourcesService,
        private readonly ngZone: NgZone,
        private readonly databaseService: DatabaseService,
        private readonly runningContext: RunningContextService,
        private readonly loggingService: LoggingService,
        private readonly toastService: ToastService) {

        this.state = "None";
    }

    public initialize() {
        if (!this.runningContext.isCordova || !navigator.app) {
            return;
        }
        document.addEventListener("backbutton", async (e) => {
            e.preventDefault();
            await this.ngZone.run(async () => {
                setTimeout(() => { this.state = "None" }, 5000);
                if (this.state === "FirstClick") {
                    this.state = "SecondClick";
                    this.toastService.info(this.resources.wrappingThingsUp);
                    await this.loggingService.debug("Starting IHM Application Exit");
                    await this.databaseService.close();
                    await this.loggingService.debug("Finished IHM Application Exit");
                    if (!this.runningContext.isProduction) {
                        await this.moveLogFile();
                    }
                    navigator.app.exitApp();
                } else if (this.state === "None") {
                    this.state = "FirstClick";
                    this.toastService.info(this.resources.clickBackAgainToCloseTheApp);
                    history.back();
                }
            })
        }, false);
    }

    private moveLogFile(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let folder = device.platform.toUpperCase().indexOf("OS") !== -1
                ? cordova.file.documentsDirectory
                : cordova.file.externalRootDirectory;
            window.resolveLocalFileSystemURL(folder,
                (directoryEntry: DirectoryEntry) => {
                    directoryEntry.getDirectory("IsraelHikingMap",
                        { create: true },
                        dir => {
                            let fullFileName = "log.txt";
                            dir.getFile(fullFileName,
                                { create: false },
                                fileEntry => {
                                    let newFileName = "log_" + new Date().toISOString().split(":").join("-").replace("T", "_") + ".txt";
                                    fileEntry.moveTo(dir, newFileName, resolve, reject);
                                },
                                reject);
                        },
                        reject);
                },
                reject);
        });
    }
}