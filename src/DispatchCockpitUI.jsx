import { useEffect, useMemo, useState } from "react";
import { buildDriverAliasBook, formatRegionLabel, getPlantRegionMeta, REGION_ORDER } from "./dispatchMetadata.js";
import { PlantRibbon } from "./PlantRibbon.jsx";

// Corrected integration from the material requirements PDF.
// Uses the real plant numbers and names from the report.
// Only these materials are shown: cement, fly ash, plc, lc3.

const SAMPLE_PLANTS = [{"id":1,"name":"riverside","reportDate":"2026-03-27","maxBlockYards":810.5,"materials":{"cement":{"present":true,"onHand":8.25,"diff":-0.16,"requiredLoads":2.0,"time":"12:14","finalTons":240.55,"finalLoads":8.59,"pdfLoads":8.41,"blockYards":810.5},"flyAsh":{"present":true,"onHand":4.0,"diff":3.11,"requiredLoads":0.0,"time":"12:14","finalTons":25.4,"finalLoads":0.91,"pdfLoads":0.89,"blockYards":457.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":2,"name":"moreno valley","reportDate":"2026-03-27","maxBlockYards":1013.0,"materials":{"cement":{"present":true,"onHand":12.25,"diff":3.4,"requiredLoads":0.0,"time":"15:44","finalTons":253.14,"finalLoads":9.04,"pdfLoads":8.85,"blockYards":1013.0},"flyAsh":{"present":true,"onHand":2.25,"diff":2.03,"requiredLoads":0.0,"time":"12:28","finalTons":6.38,"finalLoads":0.23,"pdfLoads":0.22,"blockYards":159.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":3,"name":"redlands","reportDate":"2026-03-27","maxBlockYards":722.0,"materials":{"cement":{"present":true,"onHand":8.25,"diff":0.89,"requiredLoads":0.0,"time":"23:26","finalTons":210.61,"finalLoads":7.52,"pdfLoads":7.36,"blockYards":722.0},"flyAsh":{"present":true,"onHand":1.25,"diff":1.13,"requiredLoads":0.0,"time":"10:46","finalTons":3.32,"finalLoads":0.12,"pdfLoads":0.12,"blockYards":83.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":4,"name":"fontana","reportDate":"2026-03-27","maxBlockYards":352.5,"materials":{"cement":{"present":true,"onHand":11.75,"diff":9.4,"requiredLoads":0.0,"time":"14:09","finalTons":67.31,"finalLoads":2.4,"pdfLoads":2.35,"blockYards":271.5},"flyAsh":{"present":true,"onHand":1.5,"diff":0.89,"requiredLoads":0.0,"time":"14:09","finalTons":17.4,"finalLoads":0.62,"pdfLoads":0.61,"blockYards":352.5},"plc":{"present":true,"onHand":4.5,"diff":2.27,"requiredLoads":0.0,"time":"05:36","finalTons":63.71,"finalLoads":2.28,"pdfLoads":2.23,"blockYards":310.0},"lc3":{"present":false}}},{"id":5,"name":"pomona","reportDate":"2026-03-27","maxBlockYards":606.0,"materials":{"cement":{"present":true,"onHand":10.0,"diff":5.27,"requiredLoads":0.0,"time":"11:30","finalTons":135.3,"finalLoads":4.83,"pdfLoads":4.73,"blockYards":606.0},"flyAsh":{"present":true,"onHand":3.0,"diff":2.87,"requiredLoads":0.0,"time":"11:30","finalTons":3.77,"finalLoads":0.13,"pdfLoads":0.13,"blockYards":68.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":6,"name":"san jacinto","reportDate":"2026-03-27","maxBlockYards":404.5,"materials":{"cement":{"present":true,"onHand":3.5,"diff":0.15,"requiredLoads":0.0,"time":"12:27","finalTons":95.74,"finalLoads":3.42,"pdfLoads":3.35,"blockYards":404.5},"flyAsh":{"present":true,"onHand":2.25,"diff":2.14,"requiredLoads":0.0,"time":"10:22","finalTons":3.12,"finalLoads":0.11,"pdfLoads":0.11,"blockYards":70.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":7,"name":"beaumont","reportDate":"2026-03-27","maxBlockYards":145.0,"materials":{"cement":{"present":true,"onHand":7.0,"diff":5.47,"requiredLoads":0.0,"time":"12:04","finalTons":43.89,"finalLoads":1.57,"pdfLoads":1.53,"blockYards":145.0},"flyAsh":{"present":true,"onHand":2.5,"diff":2.46,"requiredLoads":0.0,"time":"12:04","finalTons":1.01,"finalLoads":0.04,"pdfLoads":0.04,"blockYards":20.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":8,"name":"sun city","reportDate":"2026-03-27","maxBlockYards":911.0,"materials":{"cement":{"present":true,"onHand":11.5,"diff":1.87,"requiredLoads":0.0,"time":"23:52","finalTons":275.43,"finalLoads":9.84,"pdfLoads":9.63,"blockYards":911.0},"flyAsh":{"present":true,"onHand":1.25,"diff":1.14,"requiredLoads":0.0,"time":"23:52","finalTons":3.27,"finalLoads":0.12,"pdfLoads":0.11,"blockYards":61.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":9,"name":"arrowhead","reportDate":"2026-03-27","maxBlockYards":100.0,"materials":{"cement":{"present":true,"onHand":1.5,"diff":0.43,"requiredLoads":0.0,"time":"10:52","finalTons":30.7,"finalLoads":1.1,"pdfLoads":1.07,"blockYards":100.0},"flyAsh":{"present":false},"plc":{"present":false},"lc3":{"present":false}}},{"id":10,"name":"santa fe sprins","reportDate":"2026-03-27","maxBlockYards":95.5,"materials":{"cement":{"present":true,"onHand":0.5,"diff":-0.51,"requiredLoads":2.0,"time":"10:06","finalTons":28.81,"finalLoads":1.03,"pdfLoads":1.01,"blockYards":95.5},"flyAsh":{"present":false},"plc":{"present":false},"lc3":{"present":false}}},{"id":11,"name":"cabazon","reportDate":"2026-03-27","maxBlockYards":342.0,"materials":{"cement":{"present":true,"onHand":5.5,"diff":2.44,"requiredLoads":0.0,"time":"11:09","finalTons":87.61,"finalLoads":3.13,"pdfLoads":3.06,"blockYards":342.0},"flyAsh":{"present":true,"onHand":2.5,"diff":2.45,"requiredLoads":0.0,"time":"07:13","finalTons":1.38,"finalLoads":0.05,"pdfLoads":0.05,"blockYards":30.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":13,"name":"irwindale","reportDate":"2026-03-27","maxBlockYards":610.0,"materials":{"cement":{"present":true,"onHand":9.0,"diff":3.39,"requiredLoads":0.0,"time":"14:34","finalTons":160.42,"finalLoads":5.73,"pdfLoads":5.61,"blockYards":610.0},"flyAsh":{"present":true,"onHand":2.0,"diff":1.95,"requiredLoads":0.0,"time":"12:10","finalTons":1.47,"finalLoads":0.05,"pdfLoads":0.05,"blockYards":41.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":14,"name":"pasadena","reportDate":"2026-03-27","maxBlockYards":109.0,"materials":{"cement":{"present":true,"onHand":5.0,"diff":4.3,"requiredLoads":0.0,"time":"13:08","finalTons":20.06,"finalLoads":0.72,"pdfLoads":0.7,"blockYards":109.0},"flyAsh":{"present":true,"onHand":2.0,"diff":1.98,"requiredLoads":0.0,"time":"13:08","finalTons":0.64,"finalLoads":0.02,"pdfLoads":0.02,"blockYards":46.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":15,"name":"vernon","reportDate":"2026-03-27","maxBlockYards":565.0,"materials":{"cement":{"present":true,"onHand":5.5,"diff":-0.1,"requiredLoads":0.0,"time":"12:29","finalTons":160.16,"finalLoads":5.72,"pdfLoads":5.6,"blockYards":565.0},"flyAsh":{"present":true,"onHand":2.5,"diff":2.49,"requiredLoads":0.0,"time":"10:59","finalTons":0.25,"finalLoads":0.01,"pdfLoads":0.01,"blockYards":12.5},"plc":{"present":false},"lc3":{"present":false}}},{"id":16,"name":"anaheim","reportDate":"2026-03-27","maxBlockYards":653.0,"materials":{"cement":{"present":true,"onHand":8.0,"diff":1.91,"requiredLoads":0.0,"time":"01:26","finalTons":174.18,"finalLoads":6.22,"pdfLoads":6.09,"blockYards":653.0},"flyAsh":{"present":true,"onHand":2.5,"diff":2.3,"requiredLoads":0.0,"time":"01:26","finalTons":5.78,"finalLoads":0.21,"pdfLoads":0.2,"blockYards":154.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":17,"name":"santa ana","reportDate":"2026-03-27","maxBlockYards":280.5,"materials":{"cement":{"present":true,"onHand":2.75,"diff":0.6,"requiredLoads":0.0,"time":"14:57","finalTons":61.36,"finalLoads":2.19,"pdfLoads":2.15,"blockYards":280.5},"flyAsh":{"present":true,"onHand":3.0,"diff":2.95,"requiredLoads":0.0,"time":"11:08","finalTons":1.3,"finalLoads":0.05,"pdfLoads":0.05,"blockYards":71.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":18,"name":"lake forest","reportDate":"2026-03-27","maxBlockYards":114.5,"materials":{"cement":{"present":true,"onHand":6.5,"diff":5.29,"requiredLoads":0.0,"time":"12:21","finalTons":34.5,"finalLoads":1.23,"pdfLoads":1.21,"blockYards":114.5},"flyAsh":{"present":true,"onHand":2.25,"diff":2.2,"requiredLoads":0.0,"time":"12:51","finalTons":1.32,"finalLoads":0.05,"pdfLoads":0.05,"blockYards":20.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":19,"name":"adelanto","reportDate":"2026-03-27","maxBlockYards":1433.0,"materials":{"cement":{"present":true,"onHand":3.5,"diff":-10.06,"requiredLoads":0.0,"time":"23:19","finalTons":387.83,"finalLoads":13.85,"pdfLoads":13.56,"blockYards":1433.0},"flyAsh":{"present":true,"onHand":1.5,"diff":1.47,"requiredLoads":0.0,"time":"09:17","finalTons":0.75,"finalLoads":0.03,"pdfLoads":0.03,"blockYards":37.0},"plc":{"present":false},"lc3":{"present":true,"onHand":0.0,"diff":-7.8,"requiredLoads":9.0,"time":"07:20","finalTons":7.8,"finalLoads":0.28,"pdfLoads":7.8,"blockYards":30.0}}},{"id":20,"name":"san clemente","reportDate":"2026-03-27","maxBlockYards":105.0,"materials":{"cement":{"present":true,"onHand":7.0,"diff":5.84,"requiredLoads":0.0,"time":"12:39","finalTons":33.28,"finalLoads":1.19,"pdfLoads":1.16,"blockYards":105.0},"flyAsh":{"present":true,"onHand":3.0,"diff":2.7,"requiredLoads":0.0,"time":"12:39","finalTons":8.47,"finalLoads":0.3,"pdfLoads":0.3,"blockYards":65.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":21,"name":"irvine","reportDate":"2026-03-27","maxBlockYards":530.0,"materials":{"cement":{"present":true,"onHand":9.25,"diff":5.62,"requiredLoads":0.0,"time":"00:04","finalTons":103.93,"finalLoads":3.71,"pdfLoads":3.63,"blockYards":530.0},"flyAsh":{"present":true,"onHand":2.5,"diff":2.37,"requiredLoads":0.0,"time":"00:04","finalTons":3.65,"finalLoads":0.13,"pdfLoads":0.13,"blockYards":71.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":22,"name":"north hollywood","reportDate":"2026-03-27","maxBlockYards":712.0,"materials":{"cement":{"present":true,"onHand":10.75,"diff":4.64,"requiredLoads":0.0,"time":"13:08","finalTons":174.79,"finalLoads":6.24,"pdfLoads":6.11,"blockYards":712.0},"flyAsh":{"present":true,"onHand":2.5,"diff":2.42,"requiredLoads":0.0,"time":"11:14","finalTons":2.39,"finalLoads":0.09,"pdfLoads":0.08,"blockYards":80.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":23,"name":"paramount","reportDate":"2026-03-27","maxBlockYards":1184.0,"materials":{"cement":{"present":true,"onHand":2.25,"diff":-12.08,"requiredLoads":0.0,"time":"12:11","finalTons":409.84,"finalLoads":14.64,"pdfLoads":14.33,"blockYards":1184.0},"flyAsh":{"present":true,"onHand":2.25,"diff":2.22,"requiredLoads":0.0,"time":"12:18","finalTons":0.89,"finalLoads":0.03,"pdfLoads":0.03,"blockYards":20.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":24,"name":"rialto","reportDate":"2026-03-27","maxBlockYards":985.5,"materials":{"cement":{"present":true,"onHand":11.0,"diff":1.73,"requiredLoads":0.0,"time":"13:12","finalTons":265.03,"finalLoads":9.47,"pdfLoads":9.27,"blockYards":985.5},"flyAsh":{"present":true,"onHand":1.25,"diff":1.11,"requiredLoads":0.0,"time":"12:05","finalTons":4.04,"finalLoads":0.14,"pdfLoads":0.14,"blockYards":121.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":25,"name":"gardena","reportDate":"2026-03-27","maxBlockYards":1870.0,"materials":{"cement":{"present":true,"onHand":13.75,"diff":-4.33,"requiredLoads":6.0,"time":"11:04","finalTons":517.0,"finalLoads":18.46,"pdfLoads":18.08,"blockYards":1870.0},"flyAsh":{"present":true,"onHand":1.5,"diff":1.31,"requiredLoads":0.0,"time":"10:56","finalTons":5.54,"finalLoads":0.2,"pdfLoads":0.19,"blockYards":119.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":26,"name":"thousand palms","reportDate":"2026-03-27","maxBlockYards":118.0,"materials":{"cement":{"present":true,"onHand":5.5,"diff":4.43,"requiredLoads":0.0,"time":"09:22","finalTons":30.63,"finalLoads":1.09,"pdfLoads":1.07,"blockYards":118.0},"flyAsh":{"present":false},"plc":{"present":false},"lc3":{"present":false}}},{"id":27,"name":"murrieta","reportDate":"2026-03-27","maxBlockYards":427.0,"materials":{"cement":{"present":true,"onHand":5.75,"diff":1.57,"requiredLoads":0.0,"time":"13:14","finalTons":119.5,"finalLoads":4.27,"pdfLoads":4.18,"blockYards":427.0},"flyAsh":{"present":true,"onHand":3.0,"diff":2.96,"requiredLoads":0.0,"time":"08:17","finalTons":1.14,"finalLoads":0.04,"pdfLoads":0.04,"blockYards":30.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":28,"name":"otay mesa","reportDate":"2026-03-27","maxBlockYards":284.0,"materials":{"cement":{"present":true,"onHand":12.25,"diff":9.25,"requiredLoads":0.0,"time":"13:28","finalTons":85.91,"finalLoads":3.07,"pdfLoads":3.0,"blockYards":284.0},"flyAsh":{"present":true,"onHand":2.5,"diff":2.42,"requiredLoads":0.0,"time":"09:24","finalTons":2.38,"finalLoads":0.08,"pdfLoads":0.08,"blockYards":65.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":29,"name":"el cajon/s.d.","reportDate":"2026-03-27","maxBlockYards":531.0,"materials":{"cement":{"present":true,"onHand":7.0,"diff":2.18,"requiredLoads":0.0,"time":"13:02","finalTons":137.82,"finalLoads":4.92,"pdfLoads":4.82,"blockYards":531.0},"flyAsh":{"present":true,"onHand":3.0,"diff":2.92,"requiredLoads":0.0,"time":"13:02","finalTons":2.22,"finalLoads":0.08,"pdfLoads":0.08,"blockYards":63.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":30,"name":"corona","reportDate":"2026-03-27","maxBlockYards":194.5,"materials":{"cement":{"present":true,"onHand":7.0,"diff":5.22,"requiredLoads":0.0,"time":"09:11","finalTons":50.92,"finalLoads":1.82,"pdfLoads":1.78,"blockYards":194.5},"flyAsh":{"present":true,"onHand":3.0,"diff":2.93,"requiredLoads":0.0,"time":"09:11","finalTons":1.93,"finalLoads":0.07,"pdfLoads":0.07,"blockYards":35.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":31,"name":"hesperia","reportDate":"2026-03-27","maxBlockYards":153.5,"materials":{"cement":{"present":true,"onHand":1.7,"diff":0.42,"requiredLoads":0.0,"time":"23:36","finalTons":36.47,"finalLoads":1.3,"pdfLoads":1.28,"blockYards":153.5},"flyAsh":{"present":true,"onHand":1.0,"diff":0.94,"requiredLoads":0.0,"time":"10:17","finalTons":1.7,"finalLoads":0.06,"pdfLoads":0.06,"blockYards":60.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":32,"name":"carroll canyon","reportDate":"2026-03-27","maxBlockYards":43.0,"materials":{"cement":{"present":true,"onHand":6.4,"diff":5.91,"requiredLoads":0.0,"time":"06:16","finalTons":14.15,"finalLoads":0.51,"pdfLoads":0.49,"blockYards":43.0},"flyAsh":{"present":false},"plc":{"present":false},"lc3":{"present":false}}},{"id":33,"name":"miramar","reportDate":"2026-03-27","maxBlockYards":573.5,"materials":{"cement":{"present":true,"onHand":15.25,"diff":9.77,"requiredLoads":0.0,"time":"10:07","finalTons":156.83,"finalLoads":5.6,"pdfLoads":5.48,"blockYards":573.5},"flyAsh":{"present":true,"onHand":3.25,"diff":3.18,"requiredLoads":0.0,"time":"10:15","finalTons":2.01,"finalLoads":0.07,"pdfLoads":0.07,"blockYards":43.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":35,"name":"big bear","reportDate":"2026-03-27","maxBlockYards":97.0,"materials":{"cement":{"present":true,"onHand":2.76,"diff":1.75,"requiredLoads":0.0,"time":"13:08","finalTons":28.9,"finalLoads":1.03,"pdfLoads":1.01,"blockYards":97.0},"flyAsh":{"present":true,"onHand":0.76,"diff":0.68,"requiredLoads":0.0,"time":"13:08","finalTons":2.16,"finalLoads":0.08,"pdfLoads":0.08,"blockYards":66.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":36,"name":"escondido","reportDate":"2026-03-27","maxBlockYards":333.5,"materials":{"cement":{"present":true,"onHand":5.75,"diff":2.98,"requiredLoads":0.0,"time":"14:13","finalTons":79.19,"finalLoads":2.83,"pdfLoads":2.77,"blockYards":333.5},"flyAsh":{"present":true,"onHand":2.5,"diff":2.49,"requiredLoads":0.0,"time":"14:11","finalTons":0.32,"finalLoads":0.01,"pdfLoads":0.01,"blockYards":11.5},"plc":{"present":false},"lc3":{"present":false}}},{"id":38,"name":"ridgecrest","reportDate":"2026-03-27","maxBlockYards":10.0,"materials":{"cement":{"present":true,"onHand":4.0,"diff":3.87,"requiredLoads":0.0,"time":"09:06","finalTons":3.83,"finalLoads":0.14,"pdfLoads":0.13,"blockYards":10.0},"flyAsh":{"present":false},"plc":{"present":false},"lc3":{"present":false}}},{"id":39,"name":"palmdale","reportDate":"2026-03-27","maxBlockYards":80.0,"materials":{"cement":{"present":true,"onHand":4.0,"diff":3.12,"requiredLoads":0.0,"time":"10:10","finalTons":25.3,"finalLoads":0.9,"pdfLoads":0.88,"blockYards":80.0},"flyAsh":{"present":false},"plc":{"present":false},"lc3":{"present":false}}},{"id":42,"name":"victorville","reportDate":"2026-03-27","maxBlockYards":122.0,"materials":{"cement":{"present":true,"onHand":8.0,"diff":6.79,"requiredLoads":0.0,"time":"10:33","finalTons":34.53,"finalLoads":1.23,"pdfLoads":1.21,"blockYards":122.0},"flyAsh":{"present":false},"plc":{"present":false},"lc3":{"present":false}}},{"id":45,"name":"barstow","reportDate":"2026-03-27","maxBlockYards":49.0,"materials":{"cement":{"present":true,"onHand":6.5,"diff":6.16,"requiredLoads":0.0,"time":"12:43","finalTons":9.82,"finalLoads":0.35,"pdfLoads":0.34,"blockYards":49.0},"flyAsh":{"present":false},"plc":{"present":false},"lc3":{"present":false}}},{"id":46,"name":"california city","reportDate":"2026-03-27","maxBlockYards":18.0,"materials":{"cement":{"present":true,"onHand":2.05,"diff":1.86,"requiredLoads":0.0,"time":"06:00","finalTons":5.5,"finalLoads":0.2,"pdfLoads":0.19,"blockYards":18.0},"flyAsh":{"present":false},"plc":{"present":false},"lc3":{"present":false}}},{"id":47,"name":"long beach","reportDate":"2026-03-27","maxBlockYards":280.0,"materials":{"cement":{"present":true,"onHand":3.36,"diff":1.86,"requiredLoads":0.0,"time":"13:25","finalTons":42.76,"finalLoads":1.53,"pdfLoads":1.5,"blockYards":280.0},"flyAsh":{"present":true,"onHand":0.0,"diff":-2.44,"requiredLoads":0.0,"time":"13:25","finalTons":2.44,"finalLoads":0.09,"pdfLoads":2.44,"blockYards":140.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":48,"name":"banning","reportDate":"2026-03-27","maxBlockYards":40.0,"materials":{"cement":{"present":true,"onHand":2.5,"diff":2.11,"requiredLoads":0.0,"time":"07:32","finalTons":11.02,"finalLoads":0.39,"pdfLoads":0.39,"blockYards":40.0},"flyAsh":{"present":true,"onHand":0.5,"diff":0.43,"requiredLoads":0.0,"time":"07:57","finalTons":1.94,"finalLoads":0.07,"pdfLoads":0.07,"blockYards":40.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":49,"name":"simi valley","reportDate":"2026-03-27","maxBlockYards":24.0,"materials":{"cement":{"present":true,"onHand":6.5,"diff":6.23,"requiredLoads":0.0,"time":"12:24","finalTons":7.72,"finalLoads":0.28,"pdfLoads":0.27,"blockYards":24.0},"flyAsh":{"present":false},"plc":{"present":false},"lc3":{"present":false}}},{"id":54,"name":"corona temescal","reportDate":"2026-03-27","maxBlockYards":258.0,"materials":{"cement":{"present":true,"onHand":7.0,"diff":5.12,"requiredLoads":0.0,"time":"11:18","finalTons":53.91,"finalLoads":1.93,"pdfLoads":1.88,"blockYards":258.0},"flyAsh":{"present":true,"onHand":2.0,"diff":1.86,"requiredLoads":0.0,"time":"11:18","finalTons":4.05,"finalLoads":0.14,"pdfLoads":0.14,"blockYards":98.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":71,"name":"henderson","reportDate":"2026-03-27","maxBlockYards":533.0,"materials":{"cement":{"present":true,"onHand":10.96,"diff":6.18,"requiredLoads":0.0,"time":"13:00","finalTons":136.8,"finalLoads":4.89,"pdfLoads":4.78,"blockYards":533.0},"flyAsh":{"present":true,"onHand":1.26,"diff":0.31,"requiredLoads":0.0,"time":"13:00","finalTons":27.18,"finalLoads":0.97,"pdfLoads":0.95,"blockYards":468.5},"plc":{"present":false},"lc3":{"present":false}}},{"id":72,"name":"lone mountain","reportDate":"2026-03-27","maxBlockYards":513.5,"materials":{"cement":{"present":true,"onHand":9.75,"diff":5.17,"requiredLoads":0.0,"time":"13:29","finalTons":131.01,"finalLoads":4.68,"pdfLoads":4.58,"blockYards":513.5},"flyAsh":{"present":true,"onHand":5.25,"diff":4.1,"requiredLoads":0.0,"time":"13:29","finalTons":32.93,"finalLoads":1.18,"pdfLoads":1.15,"blockYards":513.5},"plc":{"present":false},"lc3":{"present":false}}},{"id":73,"name":"sloan","reportDate":"2026-03-27","maxBlockYards":96.0,"materials":{"cement":{"present":true,"onHand":6.5,"diff":5.69,"requiredLoads":0.0,"time":"12:00","finalTons":23.29,"finalLoads":0.83,"pdfLoads":0.81,"blockYards":96.0},"flyAsh":{"present":true,"onHand":2.0,"diff":1.8,"requiredLoads":0.0,"time":"12:00","finalTons":5.83,"finalLoads":0.21,"pdfLoads":0.2,"blockYards":96.0},"plc":{"present":false},"lc3":{"present":false}}},{"id":74,"name":"pahrump","reportDate":"2026-03-27","maxBlockYards":154.5,"materials":{"cement":{"present":true,"onHand":2.25,"diff":0.88,"requiredLoads":0.0,"time":"22:37","finalTons":39.15,"finalLoads":1.4,"pdfLoads":1.37,"blockYards":154.5},"flyAsh":{"present":true,"onHand":1.55,"diff":1.31,"requiredLoads":0.0,"time":"22:35","finalTons":6.73,"finalLoads":0.24,"pdfLoads":0.24,"blockYards":114.5},"plc":{"present":false},"lc3":{"present":false}}},{"id":75,"name":"beesley","reportDate":"2026-03-27","maxBlockYards":528.0,"materials":{"cement":{"present":true,"onHand":25.3,"diff":20.13,"requiredLoads":0.0,"time":"13:02","finalTons":147.86,"finalLoads":5.28,"pdfLoads":5.17,"blockYards":528.0},"flyAsh":{"present":true,"onHand":4.5,"diff":4.01,"requiredLoads":0.0,"time":"13:02","finalTons":14.05,"finalLoads":0.5,"pdfLoads":0.49,"blockYards":228.0},"plc":{"present":false},"lc3":{"present":false}}}];

const SAMPLE_ORDERS = [];
const SAMPLE_LOGS = {};
const SAMPLE_ASSIGNMENTS = [];
const SAMPLE_SOURCE_ALLOCATIONS = [
  { source: "MCC-07", allocated: 0, dayPickedUp: 0, nightPickedUp: 0 },
  { source: "CMX-21", allocated: 0, dayPickedUp: 0, nightPickedUp: 0 },
  { source: "CMX-12", allocated: 0, dayPickedUp: 0, nightPickedUp: 0 },
  { source: "CPC-89", allocated: 0, dayPickedUp: 0, nightPickedUp: 0 },
  { source: "NATL-17", allocated: 0, dayPickedUp: 0, nightPickedUp: 0 },
  { source: "CAL-28", allocated: 0, dayPickedUp: 0, nightPickedUp: 0 },
  { source: "ECO-05", allocated: 0, dayPickedUp: 0, nightPickedUp: 0 },
  { source: "SRMG-38", allocated: 0, dayPickedUp: 0, nightPickedUp: 0 },
];
const CRITICAL_SOURCE_LEFT_THRESHOLD = 5;
const CRITICAL_PRIORITY_COUNT = 5;

const EMPTY_LOG_ROW = {
  truck: "",
  driver: "",
  name: "",
  location: "",
  invCode: "",
  silo: "",
  time: "",
};

const MATERIALS = [
  { key: "cementTypeV", label: "cement / type v" },
  { key: "flyAsh", label: "fly ash" },
  { key: "plc", label: "plc" },
  { key: "lc3", label: "lc3" },
];

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function cloneLogs(logs) {
  const out = {};
  Object.entries(logs || {}).forEach(([plantId, rows]) => {
    out[plantId] = (rows || []).map((row) => ({ ...row }));
  });
  return out;
}

function fmt(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Number.parseFloat(Number(value).toFixed(digits)).toString();
}

function fmtSigned(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const num = Number(value);
  const body = Number.parseFloat(num.toFixed(digits)).toString();
  return num > 0 ? `+${body}` : body;
}

function normText(value) {
  return String(value || "").trim().toLowerCase();
}

function parse24(value) {
  if (!value) return null;
  const bits = String(value).split(":");
  if (bits.length !== 2) return null;
  const hours = Number(bits[0]);
  const minutes = Number(bits[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function normalizeSourceAllocation(row) {
  const allocated = toNumber(row?.allocated);
  const dayPickedUp = toNumber(row?.dayPickedUp);
  const nightPickedUp = toNumber(row?.nightPickedUp);

  return {
    source: String(row?.source || row?.name || "").trim(),
    allocated,
    dayPickedUp,
    nightPickedUp,
    left: allocated - dayPickedUp - nightPickedUp,
  };
}

function sourceLeftTone(row) {
  if (!row.allocated && !row.dayPickedUp && !row.nightPickedUp) {
    return "border-slate-200 bg-slate-50 text-slate-300";
  }
  if (row.left <= 0) return "border-red-200 bg-red-50 text-red-300";
  if (row.left <= 5) return "border-amber-200 bg-amber-50 text-amber-300";
  return "border-slate-200 bg-slate-50 text-white";
}

function driverStatusTone(status) {
  if (status === "no truck") return "border-red-200 bg-red-50 text-red-300";
  if (status === "assigned") return "border-amber-200 bg-amber-50 text-amber-300";
  return "border-slate-200 bg-slate-50 text-slate-300";
}

function emptyMaterial() {
  return {
    present: false,
    onHand: null,
    diff: null,
    requiredLoads: null,
    time: null,
    finalTons: null,
    finalLoads: null,
    pdfLoads: null,
    blockYards: null,
  };
}

function normalizeMaterial(material) {
  if (!material || !material.present) return emptyMaterial();

  return {
    present: true,
    onHand: material.onHand ?? null,
    diff: material.diff ?? null,
    requiredLoads: material.requiredLoads ?? null,
    time: material.time ?? null,
    finalTons: material.finalTons ?? null,
    finalLoads: material.finalLoads ?? null,
    pdfLoads: material.pdfLoads ?? null,
    blockYards: material.blockYards ?? null,
  };
}

function sumMaterialField(items, field) {
  const values = items
    .map((item) => item?.[field])
    .filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)))
    .map(Number);

  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function combineMaterials(...materials) {
  const presentMaterials = materials.filter((material) => material?.present);
  if (!presentMaterials.length) return emptyMaterial();

  const latestMaterial = [...presentMaterials]
    .filter((material) => material.time)
    .sort((a, b) => (parse24(b.time) ?? -1) - (parse24(a.time) ?? -1))[0];

  return {
    present: true,
    onHand: sumMaterialField(presentMaterials, "onHand"),
    diff: sumMaterialField(presentMaterials, "diff"),
    requiredLoads: sumMaterialField(presentMaterials, "requiredLoads"),
    time: latestMaterial?.time ?? null,
    finalTons: sumMaterialField(presentMaterials, "finalTons"),
    finalLoads: sumMaterialField(presentMaterials, "finalLoads"),
    pdfLoads: sumMaterialField(presentMaterials, "pdfLoads"),
    blockYards: sumMaterialField(presentMaterials, "blockYards"),
  };
}

function normalizePlant(plant) {
  const regionMeta = getPlantRegionMeta(plant);
  return {
    ...plant,
    maxBlockYards: toNumber(plant.maxBlockYards),
    region: regionMeta.region,
    cluster: regionMeta.cluster,
    materials: {
      cement: normalizeMaterial(plant.materials?.cement),
      typeV: normalizeMaterial(plant.materials?.typeV),
      flyAsh: normalizeMaterial(plant.materials?.flyAsh),
      plc: normalizeMaterial(plant.materials?.plc),
      lc3: normalizeMaterial(plant.materials?.lc3),
    },
  };
}

function getDisplayMaterials(plant) {
  return MATERIALS.map((item) => {
    if (item.key === "cementTypeV") {
      return {
        ...item,
        material: combineMaterials(plant.materials.cement, plant.materials.typeV),
      };
    }

    return {
      ...item,
      material: plant.materials[item.key],
    };
  });
}

function totalRequiredLoads(plant) {
  return getDisplayMaterials(plant).reduce((sum, item) => {
    const material = item.material;
    if (!material.present) return sum;
    return sum + Math.max(0, toNumber(material.requiredLoads));
  }, 0);
}

function latestUpdatedLabel(plant) {
  const latest = getDisplayMaterials(plant)
    .filter((item) => item.material.present && item.material.time)
    .sort((a, b) => (parse24(b.material.time) ?? -1) - (parse24(a.material.time) ?? -1))[0];

  return latest?.material?.time || "-";
}

function watchCount(plant) {
  return getDisplayMaterials(plant).filter((item) => {
    const material = item.material;
    if (!material.present) return false;
    const diff = Number(material.diff);
    return Number.isFinite(diff) && diff <= 1 && diff >= 0;
  }).length;
}

function urgentCount(plant) {
  return getDisplayMaterials(plant).filter((item) => {
    const material = item.material;
    if (!material.present) return false;
    return toNumber(material.requiredLoads) > 0 || toNumber(material.diff) < 0;
  }).length;
}

function isActivePlant(plant) {
  return getDisplayMaterials(plant).some((item) => item.material.present);
}

function materialTone(material) {
  if (!material.present) return "border-slate-200 bg-slate-50 text-slate-400";
  if (toNumber(material.requiredLoads) > 0 || toNumber(material.diff) < 0) return "border-red-200 bg-red-50 text-red-700";
  if (toNumber(material.diff) <= 1) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-white text-slate-700";
}

function plantTone(plant) {
  if (urgentCount(plant) > 0) return "border-red-300";
  if (watchCount(plant) > 0) return "border-amber-300";
  return "border-slate-200";
}

const PLANT_TILE_STYLE = {
  width: "clamp(156px, 16vw, 188px)",
  minHeight: "148px",
};

const SELECTED_PLANT_TILE_STYLE = {
  width: "clamp(320px, 30vw, 420px)",
  minHeight: "360px",
};

function PlantTile({ plant, selected, onClick }) {
  const materials = getDisplayMaterials(plant);
  const presentMaterials = materials.filter((item) => item.material.present);
  const totalReq = totalRequiredLoads(plant);
  const hasRequiredLoads = totalReq > 0;

  return (
    <div
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      data-plant-id={plant.id}
      style={selected ? SELECTED_PLANT_TILE_STYLE : PLANT_TILE_STYLE}
      className={`shrink-0 snap-start rounded-2xl border bg-white p-1.5 text-left shadow-sm transition ${plantTone(plant)} ${selected ? "ring-2 ring-slate-900/20" : "hover:border-slate-300"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">plt {plant.id}</div>
          <div className="truncate text-[13px] font-semibold lowercase text-slate-900">{plant.name}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <div className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              {formatRegionLabel(plant.region)}
            </div>
            {plant.cluster && (
              <div className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                {formatRegionLabel(plant.cluster)}
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-lg px-1.5 py-1 text-[9px] font-semibold ${urgentCount(plant) > 0 ? "bg-red-100 text-red-700" : watchCount(plant) > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
          {urgentCount(plant) > 0 ? `${urgentCount(plant)} urgent` : watchCount(plant) > 0 ? `${watchCount(plant)} watch` : "ok"}
        </div>
      </div>

      <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">yards</div>
            <div className="mt-1 text-[23px] font-semibold leading-none text-slate-900">{fmt(plant.maxBlockYards, 1)}</div>
          </div>

          <div className="text-right">
            {hasRequiredLoads ? (
              <>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">loads needed</div>
                <div className="mt-1 text-[13px] font-semibold leading-none text-slate-900">{fmt(totalReq, 2)}</div>
              </>
            ) : (
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">ready</div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <>
          <div className="mt-1 grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-600">
            <div className="grid grid-cols-2 gap-1.5">
              <div>report date <span className="font-semibold text-slate-900">{plant.reportDate}</span></div>
              <div>done/out <span className="font-semibold text-slate-900">{latestUpdatedLabel(plant)}</span></div>
              <div>region <span className="font-semibold text-slate-900">{formatRegionLabel(plant.region)}</span></div>
              <div>cluster <span className="font-semibold text-slate-900">{plant.cluster ? formatRegionLabel(plant.cluster) : "-"}</span></div>
              <div>loads needed <span className="font-semibold text-slate-900">{fmt(totalRequiredLoads(plant), 2)}</span></div>
              <div>urgent mats <span className="font-semibold text-slate-900">{urgentCount(plant)}</span></div>
            </div>
          </div>

          <div className="mt-1 grid gap-1.5 md:grid-cols-2">
            {presentMaterials.map((item) => (
              <div key={`selected-${item.key}`} className={`rounded-xl border p-2 ${materialTone(item.material)}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em]">{item.label}</div>
                  <div className="text-[10px] font-semibold">{item.material.time || "-"}</div>
                </div>

                <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px]">
                  <div>on hand <span className="font-semibold text-slate-900">{fmt(item.material.onHand, 2)}</span></div>
                  <div>diff <span className="font-semibold text-slate-900">{fmtSigned(item.material.diff, 2)}</span></div>
                  <div>yards <span className="font-semibold text-slate-900">{fmt(item.material.blockYards, 1)}</span></div>
                  <div>tons <span className="font-semibold text-slate-900">{fmt(item.material.finalTons, 2)}</span></div>
                  <div>req loads <span className="font-semibold text-slate-900">{fmt(item.material.requiredLoads, 2)}</span></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function DispatchCockpitUI({
  plantsData = SAMPLE_PLANTS,
  ordersData = SAMPLE_ORDERS,
  assignmentData = SAMPLE_ASSIGNMENTS,
  sourceAllocationsData = SAMPLE_SOURCE_ALLOCATIONS,
  initialLogs = SAMPLE_LOGS,
  dataStatus = null,
}) {
  const plants = useMemo(() => {
    return (plantsData || []).map(normalizePlant).sort((a, b) => a.id - b.id);
  }, [plantsData]);

  const [query, setQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [selectedPlantId, setSelectedPlantId] = useState(plants[0]?.id ?? null);
  const [showLeftRail, setShowLeftRail] = useState(true);
  const [showPlantLog, setShowPlantLog] = useState(true);
  const [plantLogs, setPlantLogs] = useState(() => cloneLogs(initialLogs));

  const regionCounts = useMemo(() => {
    return plants.reduce((counts, plant) => {
      counts[plant.region] = (counts[plant.region] || 0) + 1;
      return counts;
    }, {});
  }, [plants]);

  const filteredPlants = useMemo(() => {
    return plants.filter((plant) => {
      const q = query.trim().toLowerCase();
      const searchText = `${plant.id} ${plant.name} ${plant.region} ${plant.cluster || ""}`.toLowerCase();
      const isUrgent = urgentCount(plant) > 0;
      if (q && !searchText.includes(q)) return false;
      if (selectedRegion !== "all" && plant.region !== selectedRegion) return false;
      if (activeOnly && !isActivePlant(plant)) return false;
      if (urgentOnly && !isUrgent) return false;
      if (criticalOnly && !isUrgent) return false;
      return true;
    });
  }, [plants, query, selectedRegion, criticalOnly, activeOnly, urgentOnly]);

  useEffect(() => {
    if (!filteredPlants.length) {
      if (selectedPlantId !== null) setSelectedPlantId(null);
      return;
    }
    if (selectedPlantId === null) return;
    const match = filteredPlants.find((plant) => plant.id === selectedPlantId);
    if (!match) setSelectedPlantId(filteredPlants[0].id);
  }, [filteredPlants, selectedPlantId]);

  const selectedPlant = useMemo(() => {
    return filteredPlants.find((plant) => plant.id === selectedPlantId) || null;
  }, [filteredPlants, selectedPlantId]);

  const selectedLogs = selectedPlant ? plantLogs[selectedPlant.id] || [] : [];

  const summary = useMemo(() => {
    return {
      total: filteredPlants.length,
      active: filteredPlants.filter(isActivePlant).length,
      urgent: filteredPlants.filter((plant) => urgentCount(plant) > 0).length,
      req: filteredPlants.reduce((sum, plant) => sum + totalRequiredLoads(plant), 0),
    };
  }, [filteredPlants]);

  const visibleOrders = useMemo(() => {
    const rows = Array.isArray(ordersData)
      ? ordersData.filter((row) => row && Number.isFinite(Number(row.plantId)))
      : [];

    return [...rows].sort((a, b) => {
      const aStart = parse24(a.startTime) ?? 0;
      const bStart = parse24(b.startTime) ?? 0;
      const aQty = toNumber(a.orderQty);
      const bQty = toNumber(b.orderQty);
      return aStart - bStart || bQty - aQty || Number(a.plantId) - Number(b.plantId);
    });
  }, [ordersData]);

  const assignments = useMemo(() => {
    return Array.isArray(assignmentData)
      ? assignmentData.map((row) => ({
          start: row.start || "",
          driver: row.driver || "",
          name: row.name || "",
          tempTruck: row.tempTruck || "",
          assignTruck: row.assignTruck || "",
          type: row.type || "",
          locationCode: row.locationCode || "",
          location: row.location || "",
        }))
      : [];
  }, [assignmentData]);

  const driverAliases = useMemo(() => {
    return buildDriverAliasBook(assignments);
  }, [assignments]);

  const sourceAllocations = useMemo(() => {
    const rows = Array.isArray(sourceAllocationsData) && sourceAllocationsData.length
      ? sourceAllocationsData
      : SAMPLE_SOURCE_ALLOCATIONS;

    return rows
      .map(normalizeSourceAllocation)
      .filter((row) => row.source)
      .sort((a, b) => a.left - b.left || a.source.localeCompare(b.source));
  }, [sourceAllocationsData]);

  const displaySourceAllocations = useMemo(() => {
    if (!criticalOnly) return sourceAllocations;
    const criticalRows = sourceAllocations.filter(
      (row) => row.allocated > 0 && row.left <= CRITICAL_SOURCE_LEFT_THRESHOLD
    );
    return criticalRows.length > 0 ? criticalRows : sourceAllocations;
  }, [criticalOnly, sourceAllocations]);

  const priorityPours = useMemo(() => {
    return visibleOrders
      .filter((row) => toNumber(row.orderQty) >= 100)
      .sort((a, b) => {
        const qtyDiff = toNumber(b.orderQty) - toNumber(a.orderQty);
        if (qtyDiff !== 0) return qtyDiff;
        const aStart = parse24(a.startTime) ?? 0;
        const bStart = parse24(b.startTime) ?? 0;
        return aStart - bStart || Number(a.plantId) - Number(b.plantId);
      });
  }, [visibleOrders]);

  const displayPriorityPours = useMemo(() => {
    if (!criticalOnly) return priorityPours;
    return priorityPours.slice(0, CRITICAL_PRIORITY_COUNT);
  }, [criticalOnly, priorityPours]);

  const activeLogEntries = useMemo(() => {
    return Object.entries(plantLogs || {}).flatMap(([plantId, rows]) =>
      (rows || []).map((row) => ({
        plantId: Number(plantId),
        driver: normText(row?.driver),
        name: normText(row?.name),
        truck: normText(row?.truck),
      }))
    );
  }, [plantLogs]);

  const driverRoster = useMemo(() => {
    const seen = new Set();
    const rows = [];

    assignments.forEach((item, index) => {
      const driverKey = normText(item.driver);
      const nameKey = normText(item.name);
      const key = driverKey || (nameKey ? `name:${nameKey}` : `row:${index}`);
      if (seen.has(key)) return;
      seen.add(key);

      const truck = item.assignTruck || item.tempTruck || "";
      const match = activeLogEntries.find((entry) => {
        if (normText(item.driver) && normText(item.driver) === entry.driver) return true;
        if (normText(item.name) && normText(item.name) === entry.name) return true;
        if (truck && normText(truck) === entry.truck) return true;
        return false;
      });

      rows.push({
        key,
        driver: driverAliases.labelForAssignment(item),
        truck: truck || "-",
        status: match ? "assigned" : truck ? "available" : "no truck",
        plantId: match?.plantId ?? null,
      });
    });

    return rows.sort((a, b) => {
      const weight = (status) => (status === "no truck" ? 0 : status === "assigned" ? 1 : 2);
      return weight(a.status) - weight(b.status) || a.driver.localeCompare(b.driver);
    });
  }, [activeLogEntries, assignments, driverAliases]);

  const displayDriverRoster = useMemo(() => {
    return driverRoster;
  }, [driverRoster]);

  const assignmentOptions = useMemo(() => {
    const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

    return {
      drivers: unique(assignments.map((item) => item.driver)),
      names: unique(assignments.map((item) => item.name)),
      locations: unique(assignments.map((item) => item.location)),
    };
  }, [assignments]);

  function findAssignmentMatch(field, value) {
    const normalized = normText(value);
    if (!normalized) return null;

    const matches = assignments.filter((item) => normText(item[field]) === normalized);
    if (matches.length === 1) return matches[0];

    if (field === "driver") {
      const aliasMatches = assignments.filter(
        (item) => normText(driverAliases.get(item.driver, item.name)) === normalized
      );
      return aliasMatches.length === 1 ? aliasMatches[0] : null;
    }

    return matches.length === 1 ? matches[0] : null;
  }

  useEffect(() => {
    setPlantLogs(cloneLogs(initialLogs));
  }, [initialLogs]);

  useEffect(() => {
    setSelectedPlantId((current) => {
      if (!plants.length) return null;
      return plants.some((plant) => plant.id === current) ? current : plants[0].id;
    });
  }, [plants]);

  function updateLogCell(rowIndex, field, value) {
    if (!selectedPlant) return;

    setPlantLogs((prev) => {
      const current = prev[selectedPlant.id] || [];
      const next = current.map((row, index) => {
        if (index !== rowIndex) return row;

        const updated = { ...row, [field]: value };
        if (!["driver", "name", "location"].includes(field)) return updated;

        const match = findAssignmentMatch(field, value);
        if (!match) return updated;

        return {
          ...updated,
          driver: match.driver || updated.driver,
          name: match.name || updated.name,
          location: match.location || updated.location,
          truck: updated.truck || match.assignTruck || match.tempTruck || "",
        };
      });

      return {
        ...prev,
        [selectedPlant.id]: next,
      };
    });
  }

  function addLogRow() {
    if (!selectedPlant) return;

    setPlantLogs((prev) => ({
      ...prev,
      [selectedPlant.id]: [...(prev[selectedPlant.id] || []), { ...EMPTY_LOG_ROW }],
    }));
  }

  function removeLogRow(rowIndex) {
    if (!selectedPlant) return;

    setPlantLogs((prev) => {
      const current = prev[selectedPlant.id] || [];
      return {
        ...prev,
        [selectedPlant.id]: current.filter((_, index) => index !== rowIndex),
      };
    });
  }

  const dataStatusTone =
    dataStatus?.tone === "sample"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <>
      <style>{`
        .dark-cockpit {
          background: #000;
          color: #fff;
        }
        .dark-cockpit [class*="bg-white"] {
          background: #09090b !important;
        }
        .dark-cockpit [class*="bg-slate-50"] {
          background: #18181b !important;
        }
        .dark-cockpit [class*="bg-slate-100"] {
          background: #27272a !important;
        }
        .dark-cockpit [class*="bg-red-50"],
        .dark-cockpit [class*="bg-red-100"] {
          background: rgba(127, 29, 29, 0.35) !important;
        }
        .dark-cockpit [class*="bg-amber-50"],
        .dark-cockpit [class*="bg-amber-100"] {
          background: rgba(120, 53, 15, 0.35) !important;
        }
        .dark-cockpit [class*="border-slate-100"],
        .dark-cockpit [class*="border-slate-200"],
        .dark-cockpit [class*="border-slate-300"] {
          border-color: #27272a !important;
        }
        .dark-cockpit [class*="border-red-200"],
        .dark-cockpit [class*="border-red-300"] {
          border-color: rgba(248, 113, 113, 0.35) !important;
        }
        .dark-cockpit [class*="border-amber-200"],
        .dark-cockpit [class*="border-amber-300"] {
          border-color: rgba(251, 191, 36, 0.35) !important;
        }
        .dark-cockpit .text-slate-900,
        .dark-cockpit .text-slate-700,
        .dark-cockpit .text-slate-600,
        .dark-cockpit .text-slate-500,
        .dark-cockpit .text-slate-400 {
          color: #fff !important;
        }
        .dark-cockpit input,
        .dark-cockpit select {
          background: #111111 !important;
          color: #fff !important;
          border-color: #3f3f46 !important;
        }
        .dark-cockpit input::placeholder {
          color: #a1a1aa !important;
        }
        .dark-cockpit .plant-strip-panel {
          background: #18181b !important;
          color: #ffffff !important;
        }
        .dark-cockpit .plant-strip-panel [class*="bg-white"] {
          background: #18181b !important;
        }
        .dark-cockpit .plant-strip-panel [class*="bg-slate-50"] {
          background: #27272a !important;
        }
        .dark-cockpit .plant-strip-panel [class*="bg-slate-100"] {
          background: #3f3f46 !important;
        }
        .dark-cockpit .plant-strip-panel .text-slate-900,
        .dark-cockpit .plant-strip-panel .text-slate-700,
        .dark-cockpit .plant-strip-panel .text-slate-600,
        .dark-cockpit .plant-strip-panel .text-slate-500,
        .dark-cockpit .plant-strip-panel .text-slate-400 {
          color: #ffffff !important;
        }
        .dark-cockpit .plant-strip-panel [class*="border-slate-100"],
        .dark-cockpit .plant-strip-panel [class*="border-slate-200"],
        .dark-cockpit .plant-strip-panel [class*="border-slate-300"] {
          border-color: #3f3f46 !important;
        }
        .dark-cockpit .plant-strip-panel .overflow-x-auto {
          scrollbar-color: #52525b #18181b;
        }
        .dark-cockpit .plant-strip-panel .overflow-x-auto::-webkit-scrollbar {
          height: 12px;
        }
        .dark-cockpit .plant-strip-panel .overflow-x-auto::-webkit-scrollbar-track {
          background: #18181b;
        }
        .dark-cockpit .plant-strip-panel .overflow-x-auto::-webkit-scrollbar-thumb {
          background: #52525b;
          border-radius: 9999px;
          border: 2px solid #18181b;
        }
      `}</style>
      <div className="dark-cockpit h-screen overflow-hidden bg-black p-4 text-white">
      <div className={`mx-auto grid h-full max-w-[1800px] gap-3 ${showLeftRail ? "xl:grid-cols-[280px_minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)]"}`}>
        {showLeftRail ? (
        <div className="min-h-0">
          <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[1fr_0.65fr_0.8fr] bg-slate-50 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <div>driver</div>
                <div>truck</div>
                <div>status</div>
              </div>

              <div className="max-h-[260px] divide-y divide-slate-200 overflow-auto">
                {displayDriverRoster.length > 0 ? (
                  displayDriverRoster.map((row) => (
                    <div
                      key={row.key}
                      className="grid grid-cols-[1fr_0.65fr_0.8fr] items-center gap-1.5 px-2.5 py-1.5 text-[11px]"
                    >
                      <div className="truncate font-semibold text-slate-900">{row.driver}</div>
                      <div className="truncate text-slate-700">{row.truck}</div>
                      <div className={`rounded-md border px-1.5 py-0.5 text-center text-[10px] font-semibold ${driverStatusTone(row.status)}`}>
                        {row.status === "assigned" && row.plantId ? `PLT ${row.plantId}` : row.status}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-2.5 py-2 text-[10px] text-slate-500">no driver exceptions</div>
                )}
              </div>
            </div>

            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[0.9fr_0.6fr_0.6fr_0.55fr] bg-slate-50 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <div>ord#</div>
                <div>time</div>
                <div>plt</div>
                <div className="text-right">yrds</div>
              </div>

              <div className="max-h-[260px] divide-y divide-slate-200 overflow-auto">
                {displayPriorityPours.length > 0 ? (
                  displayPriorityPours.map((row) => {
                    return (
                      <div
                        key={`priority-${row.ord}-${row.plantId}-${row.startTime}`}
                        className="grid grid-cols-[0.9fr_0.6fr_0.6fr_0.55fr] items-center gap-1.5 px-2.5 py-1.5 text-[11px]"
                      >
                        <div className="truncate font-semibold text-slate-900">{row.ord || "-"}</div>
                        <div className="truncate text-slate-700">{row.startTime || "-"}</div>
                        <div className="truncate text-slate-700">PLT {row.plantId}</div>
                        <div className="text-right font-semibold text-slate-900">{fmt(row.orderQty, 0)}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-2.5 py-2 text-[10px] text-slate-500">no pours at or above 100 yards</div>
                )}
              </div>
            </div>

            <div className="mt-2 min-h-0 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[1.2fr_0.7fr_0.5fr_0.5fr_0.6fr] bg-slate-50 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <div>source</div>
                <div className="text-right">alloc</div>
                <div className="text-right">d</div>
                <div className="text-right">n</div>
                <div className="text-right">left</div>
              </div>

              <div className="min-h-0 divide-y divide-slate-200 overflow-auto">
                {displaySourceAllocations.length > 0 ? (
                  displaySourceAllocations.map((row) => (
                    <div
                      key={row.source}
                      className="grid grid-cols-[1.2fr_0.7fr_0.5fr_0.5fr_0.6fr] items-center gap-1.5 px-2.5 py-1.5 text-[11px]"
                    >
                      <div className="truncate font-semibold text-slate-900">{row.source}</div>
                      <div className="text-right text-slate-700">{fmt(row.allocated, 0)}</div>
                      <div className="text-right text-slate-700">{fmt(row.dayPickedUp, 0)}</div>
                      <div className="text-right text-slate-700">{fmt(row.nightPickedUp, 0)}</div>
                      <div className={`rounded-md border px-1.5 py-0.5 text-right text-[10px] font-semibold ${sourceLeftTone(row)}`}>
                        {fmt(row.left, 0)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-2.5 py-2 text-[10px] text-slate-500">no critical source rows</div>
                )}
              </div>
            </div>
          </div>
        </div>
        ) : null}

      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
        <div className="shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <button
                onClick={() => setShowLeftRail((value) => !value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-600"
              >
                {showLeftRail ? "hide side tiles" : "open side tiles"}
              </button>
              {dataStatus && (
                <div className={`max-w-full rounded-xl border px-3 py-2 text-xs ${dataStatusTone}`}>
                  {dataStatus.label}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">plants {summary.total}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">active {summary.active}</div>
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700">urgent {summary.urgent}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">req {fmt(summary.req, 2)}</div>
            </div>
          </div>

          {dataStatus?.detail && (
            <div className="mt-2 text-xs text-slate-500">{dataStatus.detail}</div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search plant or region"
              className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            />

            <button
              onClick={() => setActiveOnly((value) => !value)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${activeOnly ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            >
              active only
            </button>

            <button
              onClick={() => setUrgentOnly((value) => !value)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${urgentOnly ? "bg-red-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            >
              urgent only
            </button>

            <button
              onClick={() => setCriticalOnly((value) => !value)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${criticalOnly ? "bg-amber-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            >
              critical only
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedRegion("all")}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${selectedRegion === "all" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            >
              all regions
            </button>
            {REGION_ORDER.map((region) => (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${selectedRegion === region ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
              >
                {formatRegionLabel(region)} {regionCounts[region] || 0}
              </button>
            ))}
          </div>
        </div>

        <PlantRibbon
          filteredPlants={filteredPlants}
          selectedPlant={selectedPlant}
          setSelectedPlantId={setSelectedPlantId}
          PlantTile={PlantTile}
        />

        {selectedPlant && (showPlantLog ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">driver log</div>
                <div className="mt-1 text-base font-semibold text-slate-900">plt {selectedPlant.id} {selectedPlant.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {formatRegionLabel(selectedPlant.region)}
                  {selectedPlant.cluster ? ` - ${formatRegionLabel(selectedPlant.cluster)}` : ""}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  driver rows {selectedLogs.length}
                </div>
                <button
                  onClick={addLogRow}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  add driver row
                </button>
                <button
                  onClick={() => setShowPlantLog(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-600"
                >
                  close
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <div className="min-w-[1100px]">
                <div className="grid grid-cols-[120px_140px_210px_210px_150px_120px_120px_70px] border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <div>Truck #</div>
                  <div>Driver</div>
                  <div>Name</div>
                  <div>Location</div>
                  <div>Inv Code</div>
                  <div>Silo</div>
                  <div>Time</div>
                  <div></div>
                </div>

                {selectedLogs.length > 0 ? (
                  selectedLogs.map((row, index) => (
                    <div
                      key={`${selectedPlant.id}-${index}`}
                      className="grid grid-cols-[120px_140px_210px_210px_150px_120px_120px_70px] gap-2 border-b border-slate-100 bg-white px-4 py-2"
                    >
                      <input
                        value={row.truck}
                        onChange={(e) => updateLogCell(index, "truck", e.target.value)}
                        placeholder="truck #"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                      />
                      <input
                        value={row.driver}
                        onChange={(e) => updateLogCell(index, "driver", e.target.value)}
                        list="driver-options"
                        placeholder="driver"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                      />
                      <input
                        value={row.name || ""}
                        onChange={(e) => updateLogCell(index, "name", e.target.value)}
                        list="name-options"
                        placeholder="name"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                      />
                      <input
                        value={row.location || ""}
                        onChange={(e) => updateLogCell(index, "location", e.target.value)}
                        list="location-options"
                        placeholder="location"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                      />
                      <input
                        value={row.invCode}
                        onChange={(e) => updateLogCell(index, "invCode", e.target.value)}
                        placeholder="inv code"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                      />
                      <input
                        value={row.silo}
                        onChange={(e) => updateLogCell(index, "silo", e.target.value)}
                        placeholder="silo"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                      />
                      <input
                        value={row.time}
                        onChange={(e) => updateLogCell(index, "time", e.target.value)}
                        placeholder="time"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                      />
                      <button
                        onClick={() => removeLogRow(index)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-slate-600"
                      >
                        remove
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500">
                    <div>no driver rows yet for this plant.</div>
                    <button
                      onClick={addLogRow}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      add first driver row
                    </button>
                  </div>
                )}

                <datalist id="driver-options">
                  {assignmentOptions.drivers.map((driver) => {
                    const match = assignments.find((item) => item.driver === driver);
                    const label = [
                      driverAliases.get(driver, match?.name),
                      match?.name,
                      match?.location,
                    ].filter(Boolean).join(" - ");

                    return <option key={driver} value={driver} label={label} />;
                  })}
                </datalist>

                <datalist id="name-options">
                  {assignmentOptions.names.map((name) => {
                    const match = assignments.find((item) => item.name === name);
                    const label = [
                      driverAliases.get(match?.driver, name),
                      match?.location,
                    ].filter(Boolean).join(" - ");

                    return <option key={name} value={name} label={label} />;
                  })}
                </datalist>

                <datalist id="location-options">
                  {assignmentOptions.locations.map((location) => {
                    const match = assignments.find((item) => item.location === location);
                    const label = [
                      match?.locationCode,
                      driverAliases.get(match?.driver, match?.name),
                      match?.name,
                    ].filter(Boolean).join(" - ");

                    return <option key={location} value={location} label={label} />;
                  })}
                </datalist>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">driver log</div>
                <div className="mt-1 text-base font-semibold text-slate-900">plt {selectedPlant.id} {selectedPlant.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {formatRegionLabel(selectedPlant.region)}
                  {selectedPlant.cluster ? ` - ${formatRegionLabel(selectedPlant.cluster)}` : ""}
                </div>
              </div>
              <button
                onClick={() => setShowPlantLog(true)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-600"
              >
                open
              </button>
            </div>
          </div>
        ))}

      </div>
    </div>
    </div>
    </>
  );
}
