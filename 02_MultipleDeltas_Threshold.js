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


//a dictionary containing all the indices to be calculated
var indices = {/*name:index*/
  /*
  This is the structure of an index object
  INDEX = {
    //name of the index
    name: String, 
    //calculates the index on the image from Landsat 8
    calculate: function(ee.Image img) -> ee.Image, 
    //parameters used while displaying the image of the index
    vizualizationParameters: {}, 
    //parameters used while displaying the difference of images of the index
    vizualizationDeltaParameters: {}
  };
  */
  
  
  "EVI" : {
    name: "EVI",
    calculate: function(img){return img.expression(
              '2.5 * (NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1)', 
                {
                  'NIR': img.select('NIR'),
                  'RED': img.select('RED'),
                  'BLUE': img.select('BLUE')
                })
                .rename("EVI");
              },
    vizualizationParameters: {bands: ["EVI"],  min: -1, max: 1, palette: NDVIPalette},
    vizualizationDeltaParameters: {bands:["EVI"],  min:-0.1, max:0.1}
  },
  
  "NBR1" : {
    name: "NBR1",
    calculate: function(img){return img.normalizedDifference(["NIR","LSWIR"]);},
    vizualizationParameters:  {bands: ["NBR1"], min: 0,  max: 1, palette: NDVIPalette},
    vizualizationDeltaParameters: {bands:["NBR1"], min:-1, max:1}
  },
  
  "NBR2" : {
    name: "NBR2",
    calculate: function(img){return img.expression("2 * NIR / (SSWIR + LSWIR)",
                             {"NIR"   : img.select("NIR"),
                              "SSWIR" : img.select("SSWIR"), 
                              "LSWIR" : img.select("LSWIR")})
                  .rename("NBR2")},
    vizualizationParameters: {bands: ["NBR2"], min: 0,  max: 1, palette: NDVIPalette},
    vizualizationDeltaParameters: {bands:["NBR2"], min:-1, max:1}
  }

};
//the band names used
var bandNames = Object.keys(indices);

//Calculating the indices we are interested in processing, before and after the fire
//TO-DO remove the for loops, "there must be a better way!"
var preFireIndices = preFireImage.select();
var postFireIndices = postFireImage.select();
for(var index in indices){
  preFireIndices = preFireIndices.addBands(
    indices[index].calculate(preFireImage).rename(index));
  
  postFireIndices = postFireIndices.addBands(
    indices[index].calculate(postFireImage).rename(index));
}

//Calculates the difference in the indices
var deltaIndices = postFireIndices.subtract(preFireIndices);

//////////////////
//Classification//
//////////////////

var thresholdList  = [-0.235, -0.24, -0.685];


// separating burned and unburned pixels based on thresholds for the indices

var officialClassification =firesInGFA
  .reduceToImage([], ee.Reducer.countEvery())
  .clip(generalFireArea)
  .gte(1)
  .rename(["class"])
  //masking the zones with fires that have no dates
  .mask(invalid_zones_mask);

//Classification based on the non smoothed indices
var classificationImage = deltaIndices
  .lt(ee.Image(thresholdList));

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
var confusionHistograms = confusionImage.reduceRegion({
  reducer: ee.Reducer.fixedHistogram(0,4,4),
  scale: 30,
  maxPixels: 1e9
});

var confusionMatrices = confusionHistograms.map(function(indexName, array){
  array = ee.Array(array).long();
  return ee.ConfusionMatrix(ee.Array(
    [[array.get([0,1]), array.get([1,1])],
     [array.get([2,1]), array.get([3,1])]]
    ));
});

////////////////////////
//Results and Analysis//
////////////////////////

var results = {
  "EVI"  : {
    "-0.220" : 0.8896133884177806,
    "-0.225" : 0.8903901134716716,
    "-0.230" : 0.8907578491977388,
    "-0.235" : 0.8908649965615776,
    "-0.240" : 0.8905986214950306,
    "-0.245" : 0.8899917642130791,
    "-0.250" : 0.8890983717334054,
  },
  "NBR1" : {
    "-0.225" : 0.9228314978902796,
    "-0.230" : 0.9232087536782906,
    "-0.235" : 0.9234926755256754,
    "-0.240" : 0.9236028095756144,
    "-0.245" : 0.9235987028822268,
    "-0.250" : 0.9235023822555005,
    "-0.255" : 0.9233315811441546,
    "-0.260" : 0.9230228324685633,
  },
  "NBR2" : {
    //"-0.655" : 0.8939382965585163,
    //"-0.660" : 0.8940155770613547,
    "-0.665" : 0.8940982709327495,
    "-0.670" : 0.8941486712606876,
    "-0.675" : 0.8942026182783696,
    "-0.680" : 0.8942356584933513,
    "-0.685" : 0.894255445288764,
    "-0.690" : 0.8942265117671699,
    "-0.695" : 0.8941986982528632,
    "-0.700" : 0.8941406445417939,
    //"-0.705" : 0.8940506706230302,
  },
};


Map.centerObject(generalFireArea);
for(var idx in indices){
  print(idx);
  //Mapping the confusion image
  Map.addLayer(confusionImage, {bands : [idx], palette:["018571", "dfc27d", "80cdc1", "a6611a"], min : 0, max : 3},
              idx + " ConfusionImage", true);
  
  //Histogram
  print(ui.Chart.image.histogram(
      deltaIndices.select()
      .addBands(deltaIndices.select(idx).clip(firesInGFA.geometry()).rename("BurnedArea"))
      .addBands(deltaIndices.select(idx).clip(generalFireArea.difference(firesInGFA.geometry())).rename("NonBurnedArea"))
    , generalFireArea, 30)
    .setOptions({title: idx + " by zone", colors: ["dfc27d", "80cdc1"], vAxis: {title: "Frequency"}, hAxis: {title: "Threshold"}})
  );
  
  //accuracy graph
  var lables = [];
  var acc = [];
  for(var lable in results[idx]){
    lables.push(lable);
    acc.push(results[idx][lable]);
  }
  
  
  
  print(
    ui.Chart.array.values(acc,0, lables)
      .setChartType("ScatterChart")
      .setOptions({title : "Accuracy from a given threshold",  vAxis: {title: "Accuracy"}, hAxis: {title: "NDVI"} })
  );
  /*
  //Constructing a confusion matrix from the classification
  var confusionHistogramArray = ee.Array(confusionImage.select(idx).reduceRegion({
    reducer: ee.Reducer.fixedHistogram(0,4,4),
    scale: 10,
    maxPixels: 1e9
  }).get(idx));
  var confusionMatrix = ee.ConfusionMatrix(ee.Array(
      [[confusionHistogramArray.get([0,1]), confusionHistogramArray.get([2,1])],
       [confusionHistogramArray.get([1,1]), confusionHistogramArray.get([3,1])]]
  ).long());
  print("Confusion Matrix:", confusionMatrix,
        "Order:", confusionMatrix.order(),
        "Accuracy:", confusionMatrix.accuracy(),
        "Kappa", confusionMatrix.kappa());
  */
}
                        

