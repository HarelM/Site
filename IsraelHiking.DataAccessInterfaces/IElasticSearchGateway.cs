﻿using System.Collections.Generic;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using NetTopologySuite.Features;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElasticSearchGateway
    {
        void Initialize(string uri = "http://localhost:9200/", bool deleteIndex = false);
        Task<List<Feature>> Search(string searchTerm, string fieldName);
        Task UpdateNamesData(List<Feature> features);
        Task UpdateHighwaysData(List<Feature> features);
        Task<List<Feature>> GetHighways(Coordinate northEast, Coordinate southWest);
    }
}