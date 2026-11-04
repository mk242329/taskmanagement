package com.example.taskapp.dynamodb;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * DynamoDB の接続先とテーブル名（application.yml の taskapp.dynamodb）。
 *
 * @param endpoint     接続先。ローカルの DynamoDB Local を使うときだけ指定する。空なら AWS の DynamoDB につなぐ
 * @param cardsTable   カードを入れるテーブル
 * @param countersTable カードの id の連番を数えるテーブル
 * @param createTables 起動時にテーブルがなければ作るか（ローカル用。AWS では Terraform が作る）
 */
@ConfigurationProperties("taskapp.dynamodb")
public record DynamoDbProperties(String endpoint, String cardsTable, String countersTable, boolean createTables) {

	public boolean usesLocalEndpoint() {
		return endpoint != null && !endpoint.isBlank();
	}

}
