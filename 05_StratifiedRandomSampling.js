var SEED = 42;

//timezone used in the date creation
var TIMEZONE = "UTC";

//beginning and end dates for the fire
var beginningFireDate = ee.Date(new Date('2016-08-08 04:09:00'), TIMEZONE);
var endFireDate       = ee.Date(new Date('2016-08-16 12:01:00'), TIMEZONE);

//A hand drawn polygon the encompasses the fire area that we are interested in
var generalFireArea = ee.Geometry.Polygon(
  [[[-8.48419189453125, 40.70927151739562],
    [-8.485565185546875, 40.509100793127544],
    [-8.266525268554688, 40.50753459933616],
    [-8.271331787109375, 40.70823051511181]]]);


Map.centerObject(generalFireArea);

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
firesInGFA = firesInGFA.filter(ee.Filter.lte("system:time_start",endFireDate.advance(10, "day", TIMEZONE).millis()));

//The number of days before and after the fire to gather images for a collection
var deltaList = ee.List([10]);

//properties that we have set distinguishes beteen 2 images, 
//one may be obtained with a delta of 10 days and other with a delta of 15
var props = ["delta"];

//////////////////////////////
//Imports and Data filtering//
//////////////////////////////

//An image collection from where we create the before and after
var imageCollection = ee.ImageCollection("COPERNICUS/S2");

//the following lists contain information to translate from
//the Sentinel2 Band names to standard Band names via select(S2_BANDS, STD_NAMES)
//these are the bands we are intrested in using to minimize workload
var S2_BANDS  = ["B2"  , "B3"   , "B4" , "B8" , "B11"  , "B12"  ];
var STD_NAMES = ["BLUE", "GREEN", "RED", "NIR", "SSWIR", "LSWIR"];

//A geometry that represents burned area on the generalFireArea
var burnedArea = firesInGFA.geometry();
  
//A geometry that represents non burned area on the generalFireArea
var nonBurnedArea = generalFireArea.difference(burnedArea);

//ImageCollections from the general Fire Area before the fire
var preFireImageCollectionList = deltaList.map(
  function(delta){
    var preFireCollectionBeginningDate = beginningFireDate
      .advance(ee.Number(delta).multiply(-1), "day");
    return imageCollection
      .filterBounds(generalFireArea)
      .filterDate(preFireCollectionBeginningDate, beginningFireDate)
      .set({delta: ee.Number(delta), time : "pre"});
  }
);

//ImageCollections from the general Fire Area after the fire 
var postFireImageCollectionList = deltaList.map(
  function(delta){
    var postFireCollectionEndDate = endFireDate
      .advance(ee.Number(delta), "day");
    return imageCollection
      .filterBounds(generalFireArea)
      .filterDate(endFireDate, postFireCollectionEndDate)
      .set({delta: ee.Number(delta), time: "post"});
  }
);
props.push("time");

//////////////////
//Pre Processing//
//////////////////

//Mask to remove the zones with fires that have an invalid date
var invalid_zones_mask = invalidFiresInGFA
    .reduceToImage([], ee.Reducer.countEvery())
    .clip(generalFireArea)
    .gte(1)
    .rename(["default"])
    .not();

//Operations to aply to the imageCollections in order to create pre and post fire images
function collectionToImage(imageCollection){
  return ee.ImageCollection(imageCollection)
    .mean()
    .select(S2_BANDS, STD_NAMES)
    .clip(generalFireArea)
    .mask(invalid_zones_mask)
    .divide(10000)
    .copyProperties(imageCollection, props);
}

//The indices we want to calculate for the image in question

//Calculates given indices in idxs in a given image img
//idxs is optional, defaults to indicesToUse
function calculateIndices(img, idxs){
  img = ee.Image(img);
  
  //A dictionary containing all the indices to be calculated
  var indices = ee.Dictionary({/*name : function to calculate*/
  
    RED   : img.select("RED"),
    
    GREEN : img.select("GREEN"),
    
    BLUE  : img.select("BLUE"),
    
    NDVI  : img.expression("(NIR - RED) / (NIR + RED)",
                           {"RED" : img.select("RED"), 
                            "NIR" : img.select("NIR")})
               .rename("NDVI"),
    
    SAVI  : img.expression("0.5 * (NIR - RED) / (NIR + RED + 0.5)",
                           {"RED" : img.select("RED"), 
                            "NIR" : img.select("NIR")})
                .rename("SAVI"),
    
    MSI   : img.expression("SSWIR / NIR",
                           {"NIR"   : img.select("NIR"),
                            "SSWIR" : img.select("SSWIR")})
                .rename("MSI"),
  
    MIRBI : img.expression("10 * SSWIR - 9.8 * LSWIR + 2",
                           {"SSWIR" : img.select("SSWIR"), 
                            "LSWIR" : img.select("LSWIR")})
                .rename("MIRBI"),
  
    BR    : img.expression("NIR / LSWIR",
                           {"NIR"  : img.select("NIR"), 
                            "LSWIR": img.select("LSWIR")})
                .rename("BR"),
  
    NBR   : img.expression("(NIR - LSWIR) / (NIR + LSWIR)",
                           {"NIR"   : img.select("NIR") ,
                            "LSWIR" : img.select("LSWIR")})
                .rename("NBR"),
    
    NBR2  : img.expression("2 * NIR / (SSWIR + LSWIR)",
                           {"NIR"   : img.select("NIR"),
                            "SSWIR" : img.select("SSWIR"), 
                            "LSWIR" : img.select("LSWIR")})
                .rename("NBR2"),
  
    NBR3  : img.expression("(SSWIR - LSWIR) / (SSWIR + LSWIR)",
                           {"SSWIR" : img.select("SSWIR") ,
                            "LSWIR" : img.select("LSWIR")})
                .rename("NBR3"),

    NBR4  : img.expression("(NIR - LSWIR)/(((NIR + LSWIR) * GREEN) +1)",
                           {"GREEN" : img.select("GREEN"),
                            "NIR"   : img.select("NIR") ,
                            "LSWIR" : img.select("LSWIR")})
               .rename("NBR4"),

    BAI   : img.expression("1 / ((0.1 - RED)**2 + (0.06 - NIR)**2)",
                           {"RED" : img.select("SSWIR"),
                            "NIR" : img.select("SSWIR")})
                .rename("BAI"),
  });

  function addIndex(index, img){
    return  ee.Image(img).addBands(indices.get(index));
  }
  var start = img.select();

  return ee.Image(idxs.iterate(addIndex, start)).set({indices : idxs});
  
}
props.push("indices");

//Creates an imagem ready to be classified from 2 image collections
//postFireImageCollection ee.List : containing the names of the indices to calculate has a default of ["NDVI", "MIRBI", "NBR2", "BAI"]
//pre boolean  : indicates if we want layers from before the fire
//post boolean : indicates if we want layers from after the fire
//blur boolean : indicates if we want to add blured layerd to the output
function imgToClassify(preFireImageCollection, postFireImageCollection, indicesToUse, pre , post, blur){
  //if(indicesToUse === undefined) indicesToUse = ee.List(["NDVI", "SAVI", "MSI", "MIRBI", "BR", "NBR", "NBR2", "NBR3", "BAI"]);
  if(indicesToUse === undefined) indicesToUse = ee.List(["NDVI", "MIRBI", "NBR", "NBR4", "BAI"]);
  else indicesToUse = ee.List(indicesToUse);
  if(pre  === undefined) pre  = true;
  if(post === undefined) post = true;
  if(blur === undefined) blur = false;
  preFireImageCollection  = ee.ImageCollection(preFireImageCollection );
  postFireImageCollection = ee.ImageCollection(postFireImageCollection);
  
  var indicesPreFire  = ee.Image(calculateIndices(collectionToImage(preFireImageCollection ), indicesToUse));
  var indicesPostFire = ee.Image(calculateIndices(collectionToImage(postFireImageCollection), indicesToUse));
  var deltaFire       = ee.Image(indicesPreFire.subtract(indicesPostFire)
    .copyProperties(indicesPreFire, props))
    .set({time : "delta"});
  
  var res = deltaFire.rename(indicesToUse.map(function(index){return ee.String(index).cat(" delta")}));
  
  if(pre)  res = res.addBands(indicesPreFire.rename(indicesToUse.map(function(index){return ee.String(index).cat(" pre")})))
                    .set({time : ee.String(res.get("time")).cat(" pre" )});
  if(post) res = res.addBands(indicesPostFire.rename(indicesToUse.map(function(index){return ee.String(index).cat(" post")})))
                    .set({time : ee.String(res.get("time")).cat(" post")});
  if(blur){
    var corner = 1/16;
    var edge   = 1/8 ;
    var kernelArray = [[corner, edge, corner],
                       [edge  , 0   , edge  ],
                       [corner, edge, corner]];
    var kernel = ee.Kernel.fixed({
      width     : kernelArray[0].length, 
      height    : kernelArray.length,
      weights   : kernelArray,
      normalize : true});
      
    res = res.addBands(deltaFire
                        .convolve(kernel)
                        .rename(indicesToUse.map(function(index){return ee.String(index).cat("delta blured");}))
                      );
  }
  
  return res;
}   

//Computing the images to be classified
var classificationList =  preFireImageCollectionList.zip(postFireImageCollectionList)
  .map(function(prePost){
    return imgToClassify(
      ee.ImageCollection(ee.List(prePost).get(0)), 
      ee.ImageCollection(ee.List(prePost).get(1)));
  }
);

//if we want to vizualize something use the following if
if(false){
  var imgToPresent  = ee.Image(imgToClassify(preFireImageCollectionList.get(0),
                                             postFireImageCollectionList.get(0),
                                             ["RED", "GREEN", "BLUE", "NBR4"], 
                                             true, true, false));
  
  print("Image to present:", imgToPresent);
  
  Map.addLayer(imgToPresent.select(["NBR4 pre"]), {max: 0.0008004801929928362, min: 0.000060426886193454266}, "NBR4 pre");
  Map.addLayer(imgToPresent.select(["RED pre" , "GREEN pre" , "BLUE pre" ]), {min : 440, max : 1604}, "RGB pre"  );
  Map.addLayer(imgToPresent.select(["RED post", "GREEN post", "BLUE post"]), {min : 440, max : 1604}, "RGB post" );
}

//////////////////
//Classification//
//////////////////

var officialClassification = firesInGFA
    .reduceToImage([], ee.Reducer.countEvery())
    .clip(generalFireArea)
    .gte(1)
    .rename(["class"])
    .mask(invalid_zones_mask);

Map.addLayer(officialClassification, {min:0, max:1}, "official classification");  
  
//the available classifiers  
var classifiers = {
  cart : ee.Classifier.cart(),
  continuousNaiveBayes : ee.Classifier.continuousNaiveBayes(),
    //gmoLinearRegression : ee.Classifier.gmoLinearRegression(0.1), //Reggression only
  gmoMaxEnt : ee.Classifier.gmoMaxEnt(),
    //ikpamir : ee.Classifier.ikpamir(), // An internal server error has occurred 
  minimumDistance: ee.Classifier.minimumDistance(),
  naiveBayes: ee.Classifier.naiveBayes(),
    //pegasosGaussian: ee.Classifier.pegasosGaussian(), //An internal server error has occurred
    //pegasosLinear: ee.Classifier.pegasosLinear(), //An internal server error has occurred
    //pegasosPolynomial: ee.Classifier.pegasosPolynomial(), //An internal server error has occurred
  perceptron : ee.Classifier.perceptron(),
  randomForest: ee.Classifier.randomForest(),
  svm : ee.Classifier.svm(),
  winnow : ee.Classifier.winnow()
};

//the list of classifiers we want to use
var classifiersList = ["cart", "continuousNaiveBayes", "gmoMaxEnt", "randomForest"];

var imgToClassify = ee.Image(classificationList.get(0))
  .addBands(officialClassification);
  
print("Image to classify:", imgToClassify);

function landCoverStratifiedSample(imgToClassify, region, scale){
  
  var lc = ee.Image("ESA/GLOBCOVER_L4_200901_200912_V2_3")
    .select(["landcover"])
    .clip(region)
    .mask(invalid_zones_mask)
    .add(imgToClassify.select(["class"])
      .multiply(240));
  
  //I unable to make this work so i hardcoded the histogram 
  //var hist = lc.reduceRegion(ee.Reducer.frequencyHistogram(), generalFireArea, 300 ).get("landcover");
  var hist = { 100: 582, 11: 71, 110: 8, 120: 12, 130: 274, 14: 314,
               150: 102, 190: 191, 20: 256, 254: 33, 260: 24, 270: 10,
               290: 279, 30: 149, 310: 1108, 340: 115, 350: 3, 360: 3,
               370: 177, 390: 4, 430: 4, 50: 631, 70: 1579};
  var classPoints = [];  
  var classValues = [];
  for(var point in hist){
    classValues.push(parseInt(point,10));
    classPoints.push(Math.floor(hist[point] * scale));
  }

  return imgToClassify
    .addBands(lc)
    .stratifiedSample({
        numPoints   : 0,
        classBand   : "landcover",
        region      : region,
        seed        : SEED,
        scale       : 10,
        classValues : classValues,
        classPoints : classPoints 
      })
    .select(imgToClassify.bandNames())
    .set({"band_order" : imgToClassify.bandNames()});
}

var training = landCoverStratifiedSample(imgToClassify, generalFireArea, 3);

var validation = landCoverStratifiedSample(imgToClassify, generalFireArea, 2);

print("TotalNrPixels:"      , officialClassification.reduceRegion({
                                  reducer: ee.Reducer.count(), 
                                  geometry: generalFireArea, 
                                  scale: 10,
                                  maxPixels:1e10
                                }).get("class"));
print("Training Set size:"  , training.size());
print("Validation Set size:", validation.size());


var evaluationVisualizationParameters = {palette:["018571", "dfc27d", "80cdc1", "a6611a"], min : 0, max : 3};

for(var classifierName in classifiersList){
  classifierName = classifiersList[classifierName];
  print(classifierName);
  
  //Training
  var classifier = classifiers[classifierName] = classifiers[classifierName].train(training, "class");
 
  var classified   = imgToClassify.classify(classifier);
  var confusionImg = classified.multiply(2).add(officialClassification);
 
  var cm           = classifier.confusionMatrix();
  print("confusionMatrix test", cm,"accuracy", cm.accuracy(), "kappa", cm.kappa());
  var em = validation.classify(classifier)
    .errorMatrix("class", "classification",[0, 1]);
  print("errorMatrix validation", em,"order", em.order(), "accuracy", em.accuracy(), "kappa", em.kappa());
  Map.addLayer(confusionImg, evaluationVisualizationParameters, classifierName);

}


