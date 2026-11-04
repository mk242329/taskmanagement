package com.example.taskapp.dynamodb;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.BillingMode;
import software.amazon.awssdk.services.dynamodb.model.ResourceInUseException;
import software.amazon.awssdk.services.dynamodb.model.ScalarAttributeType;

/**
 * ローカル（DynamoDB Local・テスト）で、起動時にテーブルがなければ作る。
 * AWS では infra/database.tf がテーブルを作るため使わない。キーの名前と型は database.tf とそろえる。
 */
@Component
@ConditionalOnProperty(name = "taskapp.dynamodb.create-tables", havingValue = "true")
public class LocalTableCreator implements InitializingBean {

	private static final Logger log = LoggerFactory.getLogger(LocalTableCreator.class);

	private final DynamoDbClient dynamoDb;

	private final DynamoDbProperties properties;

	public LocalTableCreator(DynamoDbClient dynamoDb, DynamoDbProperties properties) {
		this.dynamoDb = dynamoDb;
		this.properties = properties;
	}

	@Override
	public void afterPropertiesSet() {
		createIfMissing(properties.cardsTable(), "id", ScalarAttributeType.N);
		createIfMissing(properties.countersTable(), "name", ScalarAttributeType.S);
	}

	private void createIfMissing(String table, String key, ScalarAttributeType keyType) {
		try {
			dynamoDb.createTable(r -> r.tableName(table)
					.attributeDefinitions(a -> a.attributeName(key).attributeType(keyType))
					.keySchema(k -> k.attributeName(key).keyType("HASH"))
					.billingMode(BillingMode.PAY_PER_REQUEST));
			log.info("DynamoDB のテーブル {} を作りました", table);
		} catch (ResourceInUseException e) {
			// すでにある
		}
	}

}
