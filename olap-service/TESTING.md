# Testing

The Maven reactor contains the Java service, API runtime WAR, launcher and property tests.

```sh
mvn verify
mvn -pl saiku-core/saiku-service -am test
mvn -pl saiku-launcher -am -P integration verify
```

The integration profile boots the API WAR in embedded Jetty and exercises its REST/XMLA surfaces. `mvn verify` does not run launcher integration tests unless the profile is enabled.