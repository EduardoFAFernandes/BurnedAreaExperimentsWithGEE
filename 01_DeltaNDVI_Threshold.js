
//A hand drawn polygon the encompasses the fire area that we are interested in
var generalFireArea = ee.Geometry.Polygon(
  [[[-8.48419189453125, 40.70927151739562],
    [-8.485565185546875, 40.509100793127544],
    [-8.266525268554688, 40.50753459933616],
    [-8.271331787109375, 40.70823051511181]]]);    

//timezone used in the date creation
var TIMEZONE = "UTC";

//beginning and end dates for the fire
var beginningFireDate = ee.Date(new Date('2016-07-14 04:09:00'), TIMEZONE);
var endFireDate       = ee.Date(new Date('2016-09-11 12:00:00'), TIMEZONE);

//The number of days before and after the fire to gather images for a collection
var delta = 10;

//////////////////////////////
//Imports and Data filtering//
//////////////////////////////

//A Feature collection with the fires we are interested in analyzing
var fires = ee.FeatureCollection("users/efafernandes_FCT-UNL/ICNF_AArdida/ICNF_AArdida_2016");

//property that contains startDate
var startProp = "DHInicio";
//property that contains endDate
var endProp = "DHFim";
//validates the date
var validDate = ":";
//the format of the date
var format   = "yyyy-MM-dd HH:mm:ss.SSS";
//filters valide dates
var filterWDate = ee.Filter.and(
  ee.Filter.stringContains(startProp, validDate),
  ee.Filter.stringContains(endProp, validDate)
);

//Only Fires in the General Fire Area with valid date
var firesInGFA = fires
  .filterBounds(generalFireArea)
  //selects features with valid dates
  .filter(filterWDate)
  //sets a start and end date on the features
  .map(function(feat){ return feat
      .set({"system:time_end":   
            ee.Date.parse(format, feat.get(endProp),    TIMEZONE).millis(),
            "system:time_start": 
            ee.Date.parse(format, feat.get(startProp),  TIMEZONE).millis()});
  });

var invalidFiresInGFA =  fires
  .filterBounds(generalFireArea)
  //selects only invalid dates
  .filter(filterWDate.not());

//all the fires that have started in the GFA
firesInGFA = firesInGFA.filter(ee.Filter.lte("system:time_start",endFireDate.advance(delta, "day", TIMEZONE).millis()));

//the following lists contain information to translate from
//the Sentinel2 Band names to standard Band names via select(S2_BANDS, STD_NAMES)
//these are the bands we are intrested in using to minimize workload
var S2_BANDS  = ["B2"  , "B3"   , "B4" , "B8" , "B11"  , "B12"  ];
var STD_NAMES = ["BLUE", "GREEN", "RED", "NIR", "SSWIR", "LSWIR"];

//An image collection from where we create the before and after
var imageCollection = ee.ImageCollection("COPERNICUS/S2")
  .select(S2_BANDS, STD_NAMES);
  
//Dates calculated based on the delta
var preFireCollectionBeginningDate = beginningFireDate.advance(- delta,"day");
var postFireCollectionEndDate = endFireDate.advance(delta,"day");

//An imageCollection from the general Fire Area before the fire
var preFireImageCollection = imageCollection
  .filterBounds(generalFireArea)
  .filterDate(preFireCollectionBeginningDate, beginningFireDate);

//An imageCollection from the general Fire Area after the fire 
var postFireImageCollection = imageCollection
  .filterBounds(generalFireArea)
  .filterDate(endFireDate, postFireCollectionEndDate);

//////////////
//Processing//
//////////////

//Mask to remove the zones with fires that have an invalid date
var invalid_zones_mask = invalidFiresInGFA
    .reduceToImage([], ee.Reducer.countEvery())
    .clip(generalFireArea)
    .gte(1)
    .not();

//Processing the image collections pre and post fire
function processCollection(collection){
  return collection
    .mean()
    .divide(10000)
    .clip(generalFireArea)
    .mask(invalid_zones_mask);
}

//An image before the fire 
var preFireImage = processCollection(preFireImageCollection);
  
//An image after the fire
var postFireImage = processCollection(postFireImageCollection);

//Palette from GEE documentation, can be found under the Examples 
//"Images/Normalized Difference". It's a familiar way of representing NDVI
var NDVIPalette = ['FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718',
                   '74A901', '66A000', '529400', '3E8601', '207401', '056201',
                   '004C00', '023B01', '012E01', '011D01', '011301'];

var NDVI = {
  name: "NDVI",
  calculate : function(img){return img.normalizedDifference(["NIR","RED"])
               .rename("NDVI");},
  vizualizationParameters: {bands: ["NDVI"], min: 0,  max: 1, palette: NDVIPalette},
  vizualizationDeltaParameters: {bands:["NDVI"], min:-0.8, max:0.25}
};

//Calculating pre, post and delta NDVI
var preFireNDVI = NDVI.calculate(preFireImage).rename("NDVI");
var postFireNDVI = NDVI.calculate(postFireImage).rename("NDVI");
var deltaNDVI = postFireNDVI.subtract(preFireNDVI);


//////////////////
//Classification//
//////////////////

//threshold used to classify burned and not burned area
var threshold = -0.23;

var officialClassification =firesInGFA
  .reduceToImage([], ee.Reducer.countEvery())
  .clip(generalFireArea)
  .gte(1)
  .rename(["class"])
  //masking the zones with fires that have no dates
  .mask(invalid_zones_mask);

// separating burned and unburned pixels based on thresholds for the indices
var classificationImage = deltaNDVI
  .lt(ee.Image([threshold]).rename("NDVI"));

/////////////////////////////
//Evaluating Classification//
/////////////////////////////

//this images discriminares 
//True Negative(0), False Negative(1),
//False Positive(2) and True Positive(3)
var confusionImage = classificationImage.multiply(2).add(
  officialClassification
);

//Constructing a confusion matrix from the classification
var confusionHistogramArray = ee.Array(confusionImage.reduceRegion({
  reducer: ee.Reducer.fixedHistogram(0,4,4),
  scale: 10,
  maxPixels: 1e9
}).get("NDVI"));
var confusionMatrix = ee.ConfusionMatrix(ee.Array(
    [[confusionHistogramArray.get([0,1]), confusionHistogramArray.get([2,1])],
     [confusionHistogramArray.get([1,1]), confusionHistogramArray.get([3,1])]]
).long());

////////////////////////
//Results and Analysis//
////////////////////////

Map.centerObject(generalFireArea);

Map.addLayer(preFireNDVI, NDVI.vizualizationParameters, 
              NDVI.name + " Pre Fire", true);
Map.addLayer(postFireNDVI, NDVI.vizualizationParameters, 
              NDVI.name + " Post Fire", true);
//Maping the difference in the index
Map.addLayer(deltaNDVI, NDVI.vizualizationDeltaParameters , 
              NDVI.name + " Delta", true);
//Maping the classification according to the index
Map.addLayer(classificationImage, {bands: NDVI.name}, 
              NDVI.name + " Classification", true);
//Mapping the confusion image
Map.addLayer(confusionImage, {palette:["018571", "dfc27d", "80cdc1", "a6611a"], min : 0, max : 3},
              NDVI.name + " ConfusionImage", true);
//Mapping the official classification
Map.addLayer(officialClassification, {min:0, max:1}, "Official Classification");  

print( ui.Chart.image.histogram(deltaNDVI.select()
      .addBands(deltaNDVI.select(NDVI.name).clip(firesInGFA.geometry()).rename("Burned Area"))
      .addBands(deltaNDVI.select(NDVI.name).clip(generalFireArea.difference(firesInGFA.geometry())).rename("Non Burned Area"))
  , generalFireArea, 30)
  .setOptions({title: "NDVI delta by zone", colors: ["dfc27d", "80cdc1"], vAxis: {title: "Frequency"}, hAxis: {title: "NDVI delta"}})
);

//These values are from multiple runs of the script
var results = {
  "-0.215" : 0.9217646909489224,
  "-0.220" : 0.9223670682017238,
  "-0.225" : 0.9226997103661154,
  "-0.230" : 0.9229136317580307,
  "-0.235" : 0.922876858185424,
  "-0.240" : 0.9226793635670589,
  "-0.245" : 0.9224312819528746,
  "-0.250" : 0.9219304520274745,
};

var lables = [];
var acc = [];
for(var lable in results){
  lables.push(lable);
  acc.push(results[lable]);
}

print(
  ui.Chart.array.values(acc,0, lables)
    .setChartType("ScatterChart")
    .setOptions({title : "Accuracy from a given threshold",  vAxis: {title: "Accuracy"}, hAxis: {title: "Threshold"} })
);
print("threshold", threshold,
      "Confusion Matrix:", confusionMatrix,
      "Order:", confusionMatrix.order(),
      "Accuracy:", confusionMatrix.accuracy(),
      "Kappa", confusionMatrix.kappa());
