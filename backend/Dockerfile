# AWS（EC2）で動かすためのバックエンドのイメージ。scripts/deploy-backend.sh がビルドする

# 1. jar を作る（テストは CI で動かしているので、ここでは飛ばす）
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw -B dependency:go-offline
COPY src src
RUN ./mvnw -B package -DskipTests

# 2. 動かす（JDK ではなく、小さい JRE のイメージを使う）
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/taskapp-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
