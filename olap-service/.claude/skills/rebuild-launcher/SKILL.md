---
name: rebuild-launcher
description: Rebuild and restart the Saiku API launcher fat-JAR without deleting it while the server is running.
---

# Rebuild the API launcher

1. Stop a running launcher before cleaning. Its JVM needs the source JAR to remain on disk for runtime class loading.
2. Build the API WAR and launcher:
   ```bash
   mvn -pl saiku-api,saiku-launcher clean
   mvn -pl saiku-launcher -am -Dmaven.test.skip=true package
   ```
3. Run it:
   ```bash
   VERSION=$(mvn -q -DforceStdout help:evaluate -Dexpression=project.version)
   SAIKU_ALLOW_DEFAULT_ADMIN=true java -jar saiku-launcher/target/saiku-$VERSION.jar serve --port 8080 --home ./saiku-home
   ```

The launcher serves the REST API at `/rest/` and XMLA at `/xmla/`. The web client is deployed separately and is not bundled in the API WAR.

If you changed the FoodMart seed schema (`saiku-launcher/src/main/resources/seed/FoodMart4.xml`), an existing `saiku-home` will not pick it up automatically. Remove `saiku-home/data/FoodMart4.xml` before relaunching.