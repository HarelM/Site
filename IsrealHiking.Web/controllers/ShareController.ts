﻿namespace IsraelHiking.Controllers {

    export interface IIOffroadCoordinates {
        latitude: number;
        longitude: number;
        altitude: number;
    }

    export interface IOffroadPostRequest {
        userMail: string;
        activityType: string;
        title: string;
        description: string;
        sharingCode: number; //should be 5 fixed
        name: string;
        path: IIOffroadCoordinates[];
    }

    export interface IShareScope extends IRootScope {
        title: string;
        shareAddress: string;
        whatappShareAddress: string;
        facebookShareAddress: string;
        width: number;
        height: number;
        size: string;
        embedText: string;
        updateToken: string;
        isLoading: boolean;
        siteUrlId: string;
        //routeDescription: string;
        openShare(e: Event);
        updateEmbedText(width: number, height: number): void;
        generateUrl(): void;
        clearShareAddress(): void;
        setSize(size: string): void;
        sendToOffroad(userMail: string, title: string, description: string): void;
    }

    export class ShareController extends BaseMapController {
        private $window: angular.IWindowService;

        constructor($scope: IShareScope,
            $uibModal: angular.ui.bootstrap.IModalService,
            $http: angular.IHttpService,
            $window: angular.IWindowService,
            mapService: Services.MapService,
            layersService: Services.Layers.LayersService,
            toastr: Toastr) {
            super(mapService);

            this.$window = $window;
            $scope.title = "";
            $scope.width = 400;
            $scope.height = 300;
            $scope.size = $scope.resources.small;
            $scope.isLoading = false;

            $scope.clearShareAddress = () => {
                $scope.shareAddress = "";
                $scope.whatappShareAddress = "";
                $scope.facebookShareAddress = "";
                $scope.siteUrlId = "";
            }

            $scope.clearShareAddress();

            $scope.updateEmbedText = (width: number, height: number) => {
                $scope.width = width;
                $scope.height = height;
                $scope.embedText = this.getEmbedText($scope);
            }

            $scope.openShare = (e: Event) => {
                $scope.embedText = this.getEmbedText($scope);
                $scope.title = layersService.getSelectedRoute() == null
                    ? ""
                    : layersService.getSelectedRoute().getData().name;
                //$scope.routeDescription = `Track generated by IHM site at ${(new Date()).toDateString()}`;
                $uibModal.open({
                    templateUrl: "controllers/shareModal.html",
                    scope: $scope
                });
                this.suppressEvents(e);
            }

            $scope.generateUrl = () => {
                $scope.isLoading = true;
                var siteUrl = {
                    Title: $scope.title,
                    JsonData: JSON.stringify(layersService.getData())
                } as Common.SiteUrl;
                $http.post(Common.Urls.urls, siteUrl).success((siteUrlResponse: Common.SiteUrl) => {
                    $scope.siteUrlId = siteUrlResponse.Id;
                    $scope.updateToken = siteUrlResponse.ModifyKey;
                    $scope.shareAddress = `http:${this.getShareAddressWithoutProtocol($scope)}`;
                    console.log($scope.shareAddress);
                    let escaped = ($window as any).encodeURIComponent($scope.shareAddress);
                    $scope.whatappShareAddress = `whatsapp://send?text=${escaped}`;
                    $scope.facebookShareAddress = `http://www.facebook.com/sharer/sharer.php?u=${escaped}`;
                    $scope.embedText = this.getEmbedText($scope);
                }).error(() => {
                    toastr.error($scope.resources.unableToGenerateUrl);
                }).finally(() => {
                    $scope.isLoading = false;
                });
            }

            $scope.setSize = (size: string) => {
                switch (size) {
                    case "Small":
                        $scope.width = 400;
                        $scope.height = 300;
                        break;
                    case "Medium":
                        $scope.width = 600;
                        $scope.height = 450;
                        break;
                    case "Large":
                        $scope.width = 800;
                        $scope.height = 600;
                        break;
                }
                $scope.embedText = this.getEmbedText($scope);
            }

            // currently can't be done from the UI until we decide how it should act.
            $scope.sendToOffroad = (userMail, title, routeDescription) => {
                if (layersService.getSelectedRoute() == null) {
                    toastr.warning($scope.resources.pleaseSelectARoute);
                    return;
                }
                let route = layersService.getSelectedRoute().getData();
                if (route.segments.length === 0) {
                    toastr.warning($scope.resources.pleaseAddPointsToRoute);
                    return;
                }
                let postData = {
                    userMail: userMail,
                    title: title,
                    activityType: "offRoading",
                    description: routeDescription,
                    sharingCode: 5, //fixed
                    path: []
                } as IOffroadPostRequest;
                for (let segment of route.segments) {
                    for (let latlngz of segment.latlngzs) {
                        postData.path.push({ altitude: latlngz.z, latitude: latlngz.lat, longitude: latlngz.lng });
                    }
                }
                let address = "https://brilliant-will-93906.appspot.com/_ah/api/myAdventureApi/v1/tracks/external";
                $http.post(address, postData).then(() => {
                    toastr.success("Route sent to off-road successfully");
                }, (err) => {
                    toastr.error(`Unable to sent route to off-road, ${JSON.stringify(err)}`);
                });
            }
        }

        private getEmbedText = ($scope: IShareScope) => {
            var shareAddress = this.getShareAddressWithoutProtocol($scope);
            return `<iframe src='${shareAddress}' width='${$scope.width}' height='${$scope.height}' frameborder='0' scrolling='no'></iframe>`;
        }

        private getShareAddressWithoutProtocol = ($scope: IShareScope) => {
            if ($scope.siteUrlId) {
                return `//${this.$window.location.host}/#!/?s=${$scope.siteUrlId}`;
            }
            return this.$window.location.href;
        }
    }
}
