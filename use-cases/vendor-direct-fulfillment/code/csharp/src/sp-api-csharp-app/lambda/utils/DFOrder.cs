using Amazon.SecretsManager;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace spApiCsharpApp
{
    public class DFOrder
    {
        public String orderId { get; set; }
        public String orderDate { get; set; }        
        public String sellingPartyId { get; set; }
        public String shipFromPartyId { get; set; }
        public String shipMethod { get; set; }
        public TransactionStatus ackTransactionStatus { get; set; }
        public TransactionStatus asnTransactionStatus { get; set; }
        public String orderStatus { get; set; }
        public List<DFOrderItems> items { get; set; }

    }
   
}
