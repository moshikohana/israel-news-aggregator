# מקורות המודלים

| קובץ | מקור | רישיון |
|---|---|---|
| `fox.glb` | [glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) - מודל מאת PixelMannen, אנימציות מאת @tomkranis | מודל CC0 1.0, אנימציות CC BY 4.0 |
| `wolf.glb`, `stag.glb`, `husky.glb`, `alpaca.glb`, `cow.glb`, `horse.glb`, `cat.glb`, `pig.glb`, `sheep.glb`, `goat.glb`, `donkey.glb`, `chicken.glb`, `crow.glb` | ערכת החיות מ-[Islandyout/engine](https://github.com/Islandyout/engine/tree/main/assets/source/kit/animals), שם הם מסומנים CC0 1.0 | CC0 1.0 |

החיות שאין להן מודל מוכן (פיל, ג'ירפה, אריה, טיגריס, ברדלס, זברה, קרנף,
פינגווין, קנגורו, טי-רקס) נבנות פרוצדורלית בקוד - ראו `js/animals.js`.

## להוסיף מודלים טובים יותר

אפשר להחליף כל מודל בקובץ GLB אחר:

1. מורידים חבילת מודלים חופשית - למשל
   [Ultimate Animated Animals של Quaternius](https://quaternius.com/packs/ultimateanimatedanimals.html) (CC0)
   או [Poly Pizza](https://poly.pizza/explore/Animals).
2. שמים את הקובץ כאן בשם שמתאים לחיה, למשל `models/lion.glb`.
3. ב-`js/animals.js` מוסיפים לאותה חיה את השורה `model: 'models/lion.glb'`
   (ואם למודל יש אנימציות: `clips: { idle: 'Idle', walk: 'Walk' }`).

האפליקציה מנרמלת כל מודל אוטומטית לגובה ולאורך האמיתיים של החיה,
מצמידה אותו לרצפה ומנגנת את אנימציית העמידה/הליכה שלו.
