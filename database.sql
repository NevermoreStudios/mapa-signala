CREATE TABLE `data` (
  `id` int(11) NOT NULL PRIMARY KEY AUTO_INCREMENT,
  `latitude` double NOT NULL,
  `longitude` double NOT NULL,
  `dbm` int(11) NOT NULL,
  `type` int(11) NOT NULL,
  `provider` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
