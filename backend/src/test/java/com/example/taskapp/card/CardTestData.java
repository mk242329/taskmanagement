package com.example.taskapp.card;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.boot.test.context.TestComponent;

import com.example.taskapp.dynamodb.DynamoDbProperties;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;

/**
 * テスト用に、DynamoDB のカードを空にしたり、決まったカードを入れたりする。
 */
@TestComponent
class CardTestData {

	private final DynamoDbClient dynamoDb;

	private final DynamoDbProperties properties;

	private final CardRepository cardRepository;

	CardTestData(DynamoDbClient dynamoDb, DynamoDbProperties properties, CardRepository cardRepository) {
		this.dynamoDb = dynamoDb;
		this.properties = properties;
		this.cardRepository = cardRepository;
	}

	/** カードをすべて消し、id の連番も 1 からに戻す */
	void clear() {
		for (Card card : cardRepository.findAll()) {
			dynamoDb.deleteItem(r -> r.tableName(properties.cardsTable())
					.key(Map.of("id", AttributeValue.fromN(card.getId().toString()))));
		}
		dynamoDb.deleteItem(r -> r.tableName(properties.countersTable())
				.key(Map.of("name", AttributeValue.fromS("card"))));
	}

	/** カードを 1 枚入れる。id は入れた順に 1 から振られる */
	void insert(String title, String description, OffsetDateTime dueAt, boolean strict, String listId, int position) {
		cardRepository.save(new Card(cardRepository.nextId(), title, description, dueAt, strict, listId, position));
	}

	void insert(String title, String listId, int position) {
		insert(title, "", null, false, listId, position);
	}

	/** リストのカードを並び順に「id:並び順」の形で返す */
	List<String> positions(String listId) {
		return cardRepository.findAll().stream()
				.filter(card -> card.getListId().equals(listId))
				.sorted((a, b) -> a.getPosition() != b.getPosition()
						? Integer.compare(a.getPosition(), b.getPosition())
						: Long.compare(a.getId(), b.getId()))
				.map(card -> card.getId() + ":" + card.getPosition())
				.toList();
	}

	int count() {
		return cardRepository.findAll().size();
	}

}
