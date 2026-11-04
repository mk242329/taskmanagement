package com.example.taskapp;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * テスト用に、使い捨ての DynamoDB Local（メモリ上だけに保存する）を起動して接続する。
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	private static final int DYNAMODB_PORT = 8000;

	@Bean
	GenericContainer<?> dynamoDbContainer() {
		return new GenericContainer<>(DockerImageName.parse("amazon/dynamodb-local:3.3.2"))
				.withCommand("-jar", "DynamoDBLocal.jar", "-inMemory", "-sharedDb")
				.withExposedPorts(DYNAMODB_PORT);
	}

	@Bean
	DynamicPropertyRegistrar dynamoDbProperties(GenericContainer<?> dynamoDbContainer) {
		return registry -> registry.add("taskapp.dynamodb.endpoint",
				() -> "http://" + dynamoDbContainer.getHost() + ":" + dynamoDbContainer.getMappedPort(DYNAMODB_PORT));
	}

}
