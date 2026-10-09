-- リマインド通知（F-08）を作らないことにしたため、通知済みの列を消す
ALTER TABLE card DROP COLUMN notified;
