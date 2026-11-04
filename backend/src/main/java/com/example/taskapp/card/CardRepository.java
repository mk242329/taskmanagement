package com.example.taskapp.card;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Repository;

import com.example.taskapp.dynamodb.DynamoDbProperties;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.dynamodb.model.ReturnValue;
import software.amazon.awssdk.services.dynamodb.model.TransactWriteItem;

/**
 * カードを DynamoDB に読み書きする。
 *
 * <p>カードは 1 枚が 1 つの項目（キーは id）。個人用で枚数が少ないため、一覧は全件を読んでから並べ替える。
 * 読み込みはすべて「強い整合性」にし、書いた直後の内容を必ず読めるようにする。
 */
@Repository
public class CardRepository {

	/** DynamoDB の 1 回のトランザクションで書ける項目の数の上限 */
	private static final int MAX_TRANSACTION_ITEMS = 100;

	/** counters テーブルで、カードの id の連番を数える項目 */
	private static final Map<String, AttributeValue> CARD_COUNTER_KEY = Map.of("name", s("card"));

	private final DynamoDbClient dynamoDb;

	private final String cardsTable;

	private final String countersTable;

	public CardRepository(DynamoDbClient dynamoDb, DynamoDbProperties properties) {
		this.dynamoDb = dynamoDb;
		this.cardsTable = properties.cardsTable();
		this.countersTable = properties.countersTable();
	}

	/**
	 * すべてのカード（順番はばらばら）。
	 */
	public List<Card> findAll() {
		return dynamoDb.scanPaginator(r -> r.tableName(cardsTable).consistentRead(true))
				.items().stream()
				.map(CardRepository::toCard)
				.toList();
	}

	public Optional<Card> findById(long id) {
		GetItemResponse response = dynamoDb.getItem(r -> r.tableName(cardsTable).key(key(id)).consistentRead(true));
		return response.hasItem() ? Optional.of(toCard(response.item())) : Optional.empty();
	}

	/**
	 * 新しいカードに付ける id（1 から順に増える）。DynamoDB には自動の連番がないため、counters テーブルの値を 1 増やして使う。
	 */
	public long nextId() {
		var response = dynamoDb.updateItem(r -> r.tableName(countersTable)
				.key(CARD_COUNTER_KEY)
				.updateExpression("ADD lastId :one")
				.expressionAttributeValues(Map.of(":one", n(1)))
				.returnValues(ReturnValue.UPDATED_NEW));
		return Long.parseLong(response.attributes().get("lastId").n());
	}

	public void save(Card card) {
		dynamoDb.putItem(r -> r.tableName(cardsTable).item(toItem(card)));
	}

	/**
	 * カードをまとめて保存し、deleteId があればそのカードを消す。
	 * 途中で失敗して並び順が崩れないよう、1 つのトランザクションで書く（100 件を超える分は分けて書く）。
	 */
	public void saveAll(List<Card> cards, Long deleteId) {
		List<TransactWriteItem> writes = new ArrayList<>();
		if (deleteId != null) {
			writes.add(TransactWriteItem.builder().delete(d -> d.tableName(cardsTable).key(key(deleteId))).build());
		}
		for (Card card : cards) {
			writes.add(TransactWriteItem.builder().put(p -> p.tableName(cardsTable).item(toItem(card))).build());
		}
		for (int from = 0; from < writes.size(); from += MAX_TRANSACTION_ITEMS) {
			List<TransactWriteItem> chunk = writes.subList(from, Math.min(from + MAX_TRANSACTION_ITEMS, writes.size()));
			dynamoDb.transactWriteItems(r -> r.transactItems(chunk));
		}
	}

	private static Map<String, AttributeValue> key(long id) {
		return Map.of("id", n(id));
	}

	private static Map<String, AttributeValue> toItem(Card card) {
		Map<String, AttributeValue> item = new HashMap<>();
		item.put("id", n(card.getId()));
		item.put("title", s(card.getTitle()));
		item.put("description", s(card.getDescription()));
		// 期限なしのときは項目を入れない
		if (card.getDueAt() != null) {
			item.put("dueAt", s(card.getDueAt().toString()));
		}
		item.put("strict", AttributeValue.fromBool(card.isStrict()));
		item.put("listId", s(card.getListId()));
		item.put("position", n(card.getPosition()));
		item.put("createdAt", s(card.getCreatedAt().toString()));
		item.put("updatedAt", s(card.getUpdatedAt().toString()));
		return item;
	}

	private static Card toCard(Map<String, AttributeValue> item) {
		AttributeValue dueAt = item.get("dueAt");
		return new Card(
				Long.parseLong(item.get("id").n()),
				item.get("title").s(),
				item.get("description").s(),
				dueAt == null ? null : OffsetDateTime.parse(dueAt.s()),
				item.get("strict").bool(),
				item.get("listId").s(),
				Integer.parseInt(item.get("position").n()),
				OffsetDateTime.parse(item.get("createdAt").s()),
				OffsetDateTime.parse(item.get("updatedAt").s()));
	}

	private static AttributeValue s(String value) {
		return AttributeValue.fromS(value);
	}

	private static AttributeValue n(long value) {
		return AttributeValue.fromN(Long.toString(value));
	}

}
