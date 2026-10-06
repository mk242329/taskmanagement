package com.example.taskapp.card;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CardRepository extends JpaRepository<Card, Long> {

	/**
	 * すべてのカードを、リストの表示順 → リスト内の並び順で取得する。
	 */
	@Query("select c from Card c join fetch c.list l order by l.displayOrder, c.position, c.id")
	List<Card> findAllOrdered();

	@Query("select c from Card c join fetch c.list where c.id = :id")
	Optional<Card> findWithListById(Long id);

	/**
	 * リスト内で次に使う並び順（一番下）。カードがなければ 0。
	 */
	@Query("select coalesce(max(c.position) + 1, 0) from Card c where c.list.id = :listId")
	int findNextPosition(String listId);

}
