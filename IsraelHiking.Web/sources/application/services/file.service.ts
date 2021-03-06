import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Style } from "mapbox-gl";
import { File as FileSystemWrapper } from "@ionic-native/file/ngx";
import { WebView } from "@ionic-native/ionic-webview/ngx";
import { last } from "lodash";
import JSZip from "jszip";

import { ImageResizeService } from "./image-resize.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { Urls } from "../urls";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./layers/routelayers/selected-route.service";
import { FitBoundsService } from "./fit-bounds.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { DataContainer } from "../models/models";

export interface IFormatViewModel {
    label: string;
    outputFormat: string;
    extension: string;
}

@Injectable()
export class FileService {
    public formats: IFormatViewModel[];

    constructor(private readonly httpClient: HttpClient,
                private readonly fileSystemWrapper: FileSystemWrapper,
                private readonly webView: WebView,
                private readonly runningContextService: RunningContextService,
                private readonly imageResizeService: ImageResizeService,
                private readonly nonAngularObjectsFactory: NonAngularObjectsFactory,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly fitBoundsService: FitBoundsService,
                private readonly loggingService: LoggingService) {
        this.formats = [
            {
                label: "GPX version 1.1 (.gpx)",
                extension: "gpx",
                outputFormat: "gpx"
            },
            {
                label: "Single track GPX (.gpx)",
                extension: "gpx",
                outputFormat: "gpx_single_track"
            },
            {
                label: "Single route GPX (.gpx)",
                extension: "gpx",
                outputFormat: "gpx_route"
            },
            {
                label: "Keyhole markup language (.kml)",
                extension: "kml",
                outputFormat: "kml"
            },
            {
                label: "Comma-separated values (.csv)",
                extension: "csv",
                outputFormat: "csv"
            },
            {
                label: "Naviguide binary route file (.twl)",
                extension: "twl",
                outputFormat: "twl",
            },
            {
                label: "All routes to a single Track GPX (.gpx)",
                extension: "gpx",
                outputFormat: "all_gpx_single_track"
            }
        ];
    }

    private async createIHMDirectoryIfNeeded(): Promise<string> {
        if (this.runningContextService.isCordova) {
            let folder = this.runningContextService.isIos
                ? this.fileSystemWrapper.documentsDirectory
                : this.fileSystemWrapper.externalRootDirectory;
            await this.fileSystemWrapper.createDir(folder, "IsraelHikingMap", true);
            return `${folder}/IsraelHikingMap`;
        }
    }

    public getFileFromEvent(e: any): File {
        let file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        if (!file) {
            return null;
        }
        let target = e.target || e.srcElement;
        target.value = "";
        return file;
    }

    public getFilesFromEvent(e: any): File[] {
        let files: FileList = e.dataTransfer ? e.dataTransfer.files : e.target.files;
        if (!files || files.length === 0) {
            return [];
        }
        let filesToReturn = [];
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < files.length; i++) {
            filesToReturn.push(files[i]);
        }
        let target = e.target || e.srcElement;
        target.value = ""; // this will reset files so we need to clone the array.
        return filesToReturn;
    }

    public getFullFilePath(relativePath: string): string {
        if (!this.runningContextService.isCordova) {
            return (window.origin || window.location.origin) + "/" + relativePath;
        }
        let path = relativePath;
        if (this.runningContextService.isIos) {
            path = this.fileSystemWrapper.applicationDirectory + "www/" + relativePath;
            path = this.webView.convertFileSrc(path);
        } else {
            path = "http://localhost/" + relativePath;
        }
        return path;
    }

    public getDataUrl(url: string): string {
        if (!url.startsWith("https://") && this.runningContextService.isCordova) {

            url = this.webView.convertFileSrc(this.fileSystemWrapper.dataDirectory + url.replace("custom://", ""));
        }
        return url;
    }

    public getStyleJsonContent(url: string, isOffline: boolean): Promise<Style> {
        if (isOffline) {
            url = last(url.split("/"));
        }
        return this.httpClient.get(this.getDataUrl(url)).toPromise() as Promise<Style>;
    }

    public saveToFile = async (fileName: string, format: string, dataContainer: DataContainer): Promise<boolean> => {
        let responseData = await this.httpClient.post(Urls.files + "?format=" + format, dataContainer).toPromise() as string;
        return await this.saveBytesResponseToFile(responseData, fileName);
    }

    public async addRoutesFromFile(file: File): Promise<any> {
        if (file.type === ImageResizeService.JPEG) {
            let container = await this.imageResizeService.resizeImageAndConvert(file);
            if (container.routes.length === 0 || container.routes[0].markers.length === 0) {
                throw new Error("no geographic information found in file...");
            }
            this.addRoutesFromContainer(container);
            return;
        }
        let formData = new FormData();
        formData.append("file", file, file.name);
        let fileContainer = await this.httpClient.post(Urls.openFile, formData).toPromise() as DataContainer;
        this.addRoutesFromContainer(fileContainer);
    }

    public openFromUrl = (url: string): Promise<DataContainer> => {
        return this.httpClient.get(Urls.files + "?url=" + url).toPromise() as Promise<DataContainer>;
    }

    public async addRoutesFromUrl(url: string) {
        let container = await this.openFromUrl(url);
        this.addRoutesFromContainer(container);
    }

    private addRoutesFromContainer(container: DataContainer) {
        this.selectedRouteService.addRoutes(container.routes);
        this.fitBoundsService.fitBounds(SpatialService.getBounds([container.southWest, container.northEast]));
    }

    private saveBytesResponseToFile = async (data: string, fileName: string): Promise<boolean> => {
        let blobToSave = this.nonAngularObjectsFactory.b64ToBlob(data, "application/octet-stream");
        return await this.saveAsWorkAround(blobToSave, fileName);
    }

    /**
     * This is an ugly workaround suggested here:
     * https://github.com/eligrey/FileSaver.js/issues/330
     * Plus cordova file save.
     * Return true if there's a need to show a toast message.
     * @param blob - the file to save
     * @param fileName - the file name
     */
    private async saveAsWorkAround(blob: Blob, fileName: string): Promise<boolean> {
        if (!this.runningContextService.isCordova) {
            this.nonAngularObjectsFactory.saveAsWrapper(blob, fileName, { autoBom: false });
            return false;
        }
        let fullFileName = new Date().toISOString().split(":").join("-").replace("T", "_")
            .replace("Z", "_") +
            fileName.replace(/[/\\?%*:|"<>]/g, "-").split(" ").join("_");
        let path = await this.createIHMDirectoryIfNeeded();
        await this.fileSystemWrapper.writeFile(path, fullFileName, blob);
        return true;
    }

    public async openIHMfile(blob: Blob,
                             poisCallback: (content: string) => Promise<void>,
                             imagesCallback: (content: string, percentage: number) => Promise<void>,
    ): Promise<void> {
        let zip = new JSZip();
        await zip.loadAsync(blob);
        await this.writePois(zip, poisCallback);
        await this.writeImages(zip, imagesCallback);

        if (!this.runningContextService.isCordova) {
            return;
        }
        await this.writeStyles(zip);
    }

    private async writePois(zip: JSZip, poisCallback: (content: string) => Promise<void>) {
        let poisFileName = Object.keys(zip.files).find(name => name.startsWith("pois/") && name.endsWith(".geojson"));
        if (poisFileName != null) {
            let poisText = (await zip.file(poisFileName).async("text")).trim();
            await poisCallback(poisText);
            this.loggingService.debug("Added pois.");
        }
    }

    private async writeImages(zip: JSZip, imagesCallback: (content: string, percentage: number) => Promise<void>) {
        let images = Object.keys(zip.files).filter(name => name.startsWith("images/") && name.endsWith(".json"));
        for (let imagesFileIndex = 0; imagesFileIndex < images.length; imagesFileIndex++) {
            let imagesFile = images[imagesFileIndex];
            await imagesCallback(await zip.file(imagesFile).async("text") as string, (imagesFileIndex + 1) / images.length * 100);
            this.loggingService.debug("Added images: " + imagesFile);
        }
    }

    private async writeStyles(zip: JSZip) {
        let styles = Object.keys(zip.files).filter(name => name.startsWith("styles/") && name.endsWith(".json"));
        for (let styleFileName of styles) {
            let styleText = (await zip.file(styleFileName).async("text")).trim();
            await this.fileSystemWrapper.writeFile(this.fileSystemWrapper.dataDirectory, styleFileName.replace("styles/", ""), styleText,
                { append: false, replace: true, truncate: 0 });
            this.loggingService.debug("Write style finished succefully!");
        }
    }

    public async zipAndStoreFile(content: string): Promise<string> {
        let zip = new JSZip();
        zip.file("log.txt", content);
        let data = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 6 } });
        try {
            let blob = this.nonAngularObjectsFactory.b64ToBlob(data, "application/zip");
            let fullFileName = "Report_" + new Date().toISOString().split(":").join("-").replace("T", "_").replace("Z", "_") + ".zip";
            let path = await this.createIHMDirectoryIfNeeded();
            await this.fileSystemWrapper.writeFile(path, fullFileName, blob);
        } catch {
            // no need to do anything
        }
        return data;
    }

    public async saveToDatabasesFolder(blob: Blob, fileName: string) {
        let path = this.runningContextService.isIos
            ? this.fileSystemWrapper.documentsDirectory
            : this.fileSystemWrapper.applicationStorageDirectory + "/databases";
        await this.fileSystemWrapper.writeFile(path, fileName, blob, { append: false, replace: true, truncate: 0 });
    }
}
