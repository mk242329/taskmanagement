package com.example.taskapp.dynamodb;

import java.net.URI;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.DynamoDbClientBuilder;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(DynamoDbProperties.class)
public class DynamoDbConfig {

	@Bean
	DynamoDbClient dynamoDbClient(DynamoDbProperties properties) {
		DynamoDbClientBuilder builder = DynamoDbClient.builder()
				.httpClientBuilder(UrlConnectionHttpClient.builder());
		if (properties.usesLocalEndpoint()) {
			// DynamoDB Local は認証情報の中身を確かめないため、ダミーの値で接続する
			builder.endpointOverride(URI.create(properties.endpoint()))
					.region(Region.AP_NORTHEAST_1)
					.credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("local", "local")));
		}
		// AWS（EC2）では、リージョンを環境変数 AWS_REGION から、認証情報を EC2 の IAM ロールから読む
		return builder.build();
	}

}
