import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule, HttpRequest } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { NgRedux } from "@angular-redux/store";
import { Device } from "@ionic-native/device/ngx";

import { ToastServiceMockCreator } from "./toast.service.spec";
import { ResourcesService } from "./resources.service";
import { WhatsAppService } from "./whatsapp.service";
import { RunningContextService } from "./running-context.service";
import { PoiService } from "./poi.service";
import { HashService } from "./hash.service";
import { DatabaseService } from "./database.service";
import { LoggingService } from "./logging.service";
import { ConnectionService } from "./connection.service";
import { GeoJsonParser } from "./geojson.parser";
import { Urls } from "../urls";
import { PointOfInterestExtended } from "../models/models";
import { SQLite } from "@ionic-native/sqlite/ngx";
import { ToastService } from "./toast.service";

describe("Poi Service", () => {

    beforeEach(() => {
        let toastMock = new ToastServiceMockCreator();
        let hashService = {};
        let connectionService = {
            monitor: () => {
                return {
                    subscribe: () => { }
                };
            }
        };
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMock.resourcesService },
                { provide: HashService, useValue: hashService },
                { provide: ConnectionService, useValue: connectionService },
                { provide: ToastService, useValue: null },
                GeoJsonParser,
                RunningContextService,
                WhatsAppService,
                PoiService,
                DatabaseService,
                LoggingService,
                NgRedux,
                Device,
                SQLite
            ]
        });
    });

    it("Should get categories from server", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

            let promise = poiService.getCategories("Points of Interest").then((resutls) => {
                expect(resutls).not.toBeNull();
                expect(resutls.length).toBe(1);
            }, fail);

            mockBackend.match(() => true)[0].flush([{ icon: "icon", name: "category" }]);
            return promise;
        })));

    it("Should get available categories types", (inject([PoiService], (poiService: PoiService) => {
        expect(poiService.getCategoriesTypes().length).toBe(2);
    })));

    it("Should get points from server", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

            let northEast = { lat: 1, lng: 2 };
            let southWest = { lat: 3, lng: 4 };

            let promise = poiService.getPoints(northEast, southWest, []).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne((request) => {
                let paramsString = request.params.toString();
                return paramsString.includes(northEast.lat + "," + northEast.lng) &&
                    paramsString.includes(southWest.lat + "," + southWest.lng);
            }).flush({});
            return promise;
        })));

    it("Should get a point by id and source from the server", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

            let id = "42";
            let source = "source";

            let promise = poiService.getPoint(id, source).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne((request: HttpRequest<any>) => {
                return request.url.includes(id) &&
                    request.url.includes(source);
            }).flush({});
            return promise;
        })));

    it("Should update point using the server and convert images to files",
        inject([PoiService, HttpTestingController],
            async (poiService: PoiService, mockBackend: HttpTestingController) => {

                let poiExtended = { imagesUrls: ["http://link.com"] } as PointOfInterestExtended;
                let promise = poiService.uploadPoint(poiExtended).then((res) => {
                    expect(res).not.toBeNull();
                });

                mockBackend.expectOne((request) => request.url.includes(Urls.poi)).flush({});
                return promise;
            }));
});
